import prisma from '../prismaClient.js';

export default async function globalTeardown(): Promise<void> {
  await prisma.$disconnect();
}
