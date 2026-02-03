import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'shaaoonn@gmail.com' },
        select: { id: true, companyId: true, role: true, email: true }
    });
    console.log('User Details:', user);

    if (user?.companyId) {
        // Check if task is in this company
        const tasks = await prisma.task.findMany({
            where: { companyId: user.companyId },
            select: { id: true, title: true }
        });
        console.log('Tasks in this company:', tasks);
    }
}

main().finally(() => prisma.$disconnect());
