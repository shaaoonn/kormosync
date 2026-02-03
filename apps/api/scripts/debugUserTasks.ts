import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'shaaoonn@gmail.com' },
        include: {
            assignedTasks: {
                select: { id: true, title: true }
            }
        }
    });

    console.log('User:', user?.name, '| Email:', user?.email);
    console.log('Assigned Tasks:', user?.assignedTasks);

    // Check "মনির ভাইয়ের কাজ" assignees
    const task = await prisma.task.findFirst({
        where: { title: { contains: 'মনির' } },
        include: { assignees: { select: { email: true } } }
    });
    console.log('\nTask "মনির ভাইয়ের কাজ" assignees:', task?.assignees);
}

main().finally(() => prisma.$disconnect());
