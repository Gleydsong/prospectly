import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../../common/prisma/prisma.service';

export type BillingDb = Prisma.TransactionClient | PrismaService;
