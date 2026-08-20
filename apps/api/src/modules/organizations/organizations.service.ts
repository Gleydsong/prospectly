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
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { EntitlementService } from '../billing/entitlement.service';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementService,
  ) {}

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

  async update(organizationId: string, name: string, actorId?: string) {
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: name.trim() },
    });

    await this.audit.log({
      organizationId,
      userId: actorId,
      action: AUDIT_ACTIONS.ORG_SETTINGS_UPDATED,
      entity: 'Organization',
      entityId: organizationId,
      metadata: { fields: ['name'] },
    });

    return organization;
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

  async inviteMember(organizationId: string, dto: InviteMemberDto, actorId?: string) {
    if (dto.role === 'OWNER') {
      throw new BadRequestException('Cannot invite members as OWNER');
    }
    await this.entitlements.assertTeamSeat(organizationId);
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { where: { organizationId } } },
    });
    if (existing && existing.memberships.length > 0) {
      throw new ConflictException('User is already a member of this organization');
    }

    const passwordHash = await argon2.hash(dto.temporaryPassword);

    const member = existing
      ? await this.attachVerifiedExistingUser(existing, organizationId, dto.role)
      : await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email, name: dto.name.trim(), passwordHash },
          });
          return tx.organizationMember.create({
            data: { userId: user.id, organizationId, role: dto.role },
            include: { user: { select: { id: true, name: true, email: true } } },
          });
        });

    await this.audit.log({
      organizationId,
      userId: actorId,
      action: AUDIT_ACTIONS.ORG_MEMBER_INVITED,
      entity: 'OrganizationMember',
      entityId: member.id,
      metadata: { role: dto.role, invitedUserId: member.userId },
    });

    return member;
  }

  private async attachVerifiedExistingUser(
    user: { id: string; emailVerifiedAt: Date | null },
    organizationId: string,
    role: Role,
  ) {
    if (!user.emailVerifiedAt) {
      throw new ConflictException(
        'A user with this email exists but has not verified it yet. Ask them to verify before inviting.',
      );
    }

    return this.prisma.organizationMember.create({
      data: { userId: user.id, organizationId, role },
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
    const updated = await this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { role },
    });

    await this.audit.log({
      organizationId,
      userId: actingUserId,
      action: AUDIT_ACTIONS.ORG_MEMBER_ROLE_UPDATED,
      entity: 'OrganizationMember',
      entityId: member.id,
      metadata: { fromRole: member.role, toRole: role, memberUserId: member.userId },
    });

    return updated;
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    actingUserId: string,
    actingRole: Role,
  ) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    // Mirror updateMemberRole: only OWNER may remove an OWNER (blocks ADMIN privilege escalation).
    if (actingRole !== 'OWNER' && member.role === 'OWNER') {
      throw new ForbiddenException('Only OWNER can remove an OWNER');
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

    await this.audit.log({
      organizationId,
      userId: actingUserId,
      action: AUDIT_ACTIONS.ORG_MEMBER_REMOVED,
      entity: 'OrganizationMember',
      entityId: member.id,
      metadata: { removedUserId: member.userId, role: member.role },
    });
  }
}
