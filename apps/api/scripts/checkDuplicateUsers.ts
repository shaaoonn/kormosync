import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { email: 'ejobsit.com@gmail.com' },
        select: { id: true, email: true, firebaseUid: true, role: true, companyId: true }
    });
    console.log('Users found:', users);
}

main().finally(() => prisma.$disconnect());
