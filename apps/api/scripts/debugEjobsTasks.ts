import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'ejobsit.com@gmail.com';
    console.log('Checking for user:', email);

    const user = await prisma.user.findFirst({
        where: { email },
        include: {
            assignedTasks: { select: { id: true, title: true } }
        }
    });

    if (!user) {
        console.log('❌ User not found!');
        return;
    }

    console.log('User Role:', user.role);
    console.log('Company ID:', user.companyId);
    console.log('Assigned Tasks (Direct Relation):', user.assignedTasks);

    // Check if tasks exist in the company generally
    if (user.companyId) {
        const companyTasks = await prisma.task.findMany({
            where: { companyId: user.companyId },
            select: { id: true, title: true, assignees: { select: { email: true } } }
        });
        console.log(`\nTasks in Company (${user.companyId}):`);
        companyTasks.forEach(t => {
            console.log(`- ${t.title} [Assignees: ${t.assignees.map(a => a.email).join(', ')}]`);
        });
    }
}

main().finally(() => prisma.$disconnect());
