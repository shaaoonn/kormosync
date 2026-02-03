import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find the user
    const user = await prisma.user.findFirst({
        where: { email: 'ejobsit.com@gmail.com' },
        include: { company: true }
    });
    console.log('User:', user?.name, '| ID:', user?.id, '| Company:', user?.companyId);

    if (!user) {
        console.log('User not found');
        return;
    }

    // Find tasks in this company
    const tasks = await prisma.task.findMany({
        where: { companyId: user.companyId! },
        include: {
            assignees: { select: { id: true, email: true } }
        }
    });
    console.log('\nTasks in company:', tasks.length);
    tasks.forEach(t => {
        console.log('  -', t.title);
        console.log('    Assignees:', t.assignees.map(a => a.email).join(', ') || 'None');
    });

    // Check if any task is assigned to this user
    const assignedTasks = await prisma.task.findMany({
        where: {
            assignees: { some: { id: user.id } }
        }
    });
    console.log('\nTasks assigned to this user:', assignedTasks.length);
    assignedTasks.forEach(t => console.log('  -', t.title));
}

main().catch(console.error).finally(() => prisma.$disconnect());
