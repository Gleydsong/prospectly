import { Injectable, Logger } from '@nestjs/common';
import { ImportStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/prisma/tenant-context';
import { RETENTION } from './retention.constants';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<{
    revokedTokens: number;
    expiredTokens: number;
    expiredAuthSecrets: number;
    importErrorsCleared: number;
    outboxEventsDeleted: number;
  }> {
    return runWithBypass(async () => {
      // R6: this job never deletes SyncedCommunication. Retention follows the Lead.
      const now = new Date();
      const revokedBefore = new Date(
        now.getTime() - RETENTION.revokedRefreshTokenDays * 24 * 60 * 60 * 1000,
      );
      const expiredBefore = new Date(
        now.getTime() - RETENTION.expiredRefreshTokenDays * 24 * 60 * 60 * 1000,
      );
      const importBefore = new Date(
        now.getTime() - RETENTION.completedImportErrorDays * 24 * 60 * 60 * 1000,
      );

      const [revokedTokens, expiredTokens, expiredResets, expiredVerifies, importErrors] =
        await Promise.all([
          this.prisma.refreshToken.deleteMany({
            where: { revokedAt: { not: null, lt: revokedBefore } },
          }),
          this.prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: expiredBefore }, revokedAt: null },
          }),
          this.prisma.user.updateMany({
            where: {
              resetTokenExpiresAt: { lt: now },
              resetTokenHash: { not: null },
            },
            data: { resetTokenHash: null, resetTokenExpiresAt: null },
          }),
          this.prisma.user.updateMany({
            where: {
              emailVerifyTokenExpiresAt: { lt: now },
              emailVerifyTokenHash: { not: null },
            },
            data: { emailVerifyTokenHash: null, emailVerifyTokenExpiresAt: null },
          }),
          this.prisma.importError.updateMany({
            where: {
              import: {
                completedAt: { lt: importBefore },
                status: { in: [ImportStatus.COMPLETED, ImportStatus.FAILED] },
              },
            },
            data: { data: Prisma.DbNull },
          }),
        ]);

      const outboxEventsDeleted = await this.deleteExpiredOutboxEvents(now);

      const result = {
        revokedTokens: revokedTokens.count,
        expiredTokens: expiredTokens.count,
        expiredAuthSecrets: expiredResets.count + expiredVerifies.count,
        importErrorsCleared: importErrors.count,
        outboxEventsDeleted,
      };
      this.logger.log({ message: 'Privacy retention job completed', ...result });
      return result;
    });
  }

  private async deleteExpiredOutboxEvents(now: Date): Promise<number> {
    const take = RETENTION.outboxEventGcBatchSize;
    let deleted = 0;
    for (;;) {
      const expired = await this.prisma.outboxEvent.findMany({
        where: { retainUntil: { lt: now } },
        select: { id: true },
        take,
        orderBy: { retainUntil: 'asc' },
      });
      if (expired.length === 0) {
        return deleted;
      }
      const result = await this.prisma.outboxEvent.deleteMany({
        where: { id: { in: expired.map((row) => row.id) } },
      });
      deleted += result.count;
      if (expired.length < take || result.count === 0) {
        return deleted;
      }
    }
  }
}
