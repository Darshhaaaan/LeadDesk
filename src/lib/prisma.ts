import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { env } from '../config/env.ts';

const adapter = new PrismaPg(env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

export { prisma };
export default prisma;
