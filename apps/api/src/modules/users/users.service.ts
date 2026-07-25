import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name?.trim(), avatarUrl: data.avatarUrl },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
  }

  async createDataSubjectRequest(userId: string, type: 'DELETE' | 'EXPORT', notes?: string) {
    return this.prisma.dataSubjectRequest.create({
      data: {
        userId,
        type,
        status: 'PENDING',
        notes: notes?.trim() || `Solicitação ${type} via API (MVP — processamento manual)`,
      },
      select: { id: true, type: true, status: true, createdAt: true },
    });
  }
}
