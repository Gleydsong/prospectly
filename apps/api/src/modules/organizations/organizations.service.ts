import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role } from '@prisma/client';
import * as argon2 from 'argon2';

import { PrismaService } from '../../common/prisma/prisma.service';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(organizationId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        planStatus: true,
        planCurrency: true,
        currentPeriodEnd: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { members: true, leads: true } },
      },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async update(organizationId: string, name: string) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: name.trim() },
    });
  }

  async listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(organizationId: string, dto: InviteMemberDto) {
    if (dto.role === 'OWNER') {
      throw new BadRequestException('Cannot invite members as OWNER');
    }
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { where: { organizationId } } },
    });
    if (existing && existing.memberships.length > 0) {
      throw new ConflictException('User is already a member of this organization');
    }

    const passwordHash = await argon2.hash(dto.temporaryPassword);

    if (existing) {
      // Unverified accounts must not be auto-attached — otherwise anyone who
      // pre-registered (or staged a pending email claim) the invite address gains org access.
      if (!existing.emailVerifiedAt) {
        throw new ConflictException(
          'A user with this email exists but has not verified it yet. Ask them to verify before inviting.',
        );
      }
      return this.prisma.organizationMember.create({
        data: { userId: existing.id, organizationId, role: dto.role },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }

    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), passwordHash },
    });
    return this.prisma.organizationMember.create({
      data: { userId: user.id, organizationId, role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: Role,
    actingUserId: string,
    actingRole: Role,
  ) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Only OWNER may assign OWNER or change an existing OWNER (blocks ADMIN privilege escalation).
    if (actingRole !== 'OWNER' && (role === 'OWNER' || member.role === 'OWNER')) {
      throw new ForbiddenException('Only OWNER can assign or change the OWNER role');
    }

    if (member.userId === actingUserId && member.role === 'OWNER' && role !== 'OWNER') {
      const owners = await this.prisma.organizationMember.count({
        where: { organizationId, role: 'OWNER' },
      });
      if (owners <= 1) {
        throw new ForbiddenException('Organization must keep at least one OWNER');
      }
    }
    return this.prisma.organizationMember.update({ where: { id: member.id }, data: { role } });
  }

  async removeMember(organizationId: string, memberId: string, actingUserId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (member.role === 'OWNER') {
      const owners = await this.prisma.organizationMember.count({
        where: { organizationId, role: 'OWNER' },
      });
      if (owners <= 1) {
        throw new ForbiddenException('Organization must keep at least one OWNER');
      }
    }
    if (member.userId === actingUserId) {
      throw new BadRequestException('Use leave flow instead of removing yourself');
    }
    await this.prisma.organizationMember.delete({ where: { id: member.id } });
  }
}
