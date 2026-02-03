import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Get User and Task
    const user = await prisma.user.findFirst({ where: { email: { contains: 'ejobs' } } }); // Prefer employee
    const task = await prisma.task.findFirst({ where: { title: { contains: 'মনির' } } });

    if (!user || !task) {
        console.log('Skipping seed: User or Task not found');
        return;
    }

    console.log(`Seeding logs for User: ${user.name} | Task: ${task.title}`);

    // 2. Create Dummy Screenshot
    // Using a placeholder image from internet
    const screenshot = await prisma.screenshot.create({
        data: {
            userId: user.id,
            imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
            activityScore: 85,
            capturedAt: new Date()
        }
    });

    console.log('Created Screenshot:', screenshot.id);

    // 3. Create Activity Logs (Last 2 hours)
    const logs = [];
    const now = new Date();

    for (let i = 0; i < 5; i++) {
        const start = new Date(now.getTime() - (i * 5 * 60 * 1000));
        const end = new Date(start.getTime() + (5 * 60 * 1000));

        logs.push({
            userId: user.id,
            taskId: task.id,
            intervalStart: start,
            intervalEnd: end,
            keystrokes: Math.floor(Math.random() * 500) + 100,
            mouseClicks: Math.floor(Math.random() * 200) + 50,
            mouseMovement: Math.floor(Math.random() * 10000) + 1000,
            activeSeconds: Math.floor(Math.random() * 100) + 200 // 200-300 seconds active
        });
    }

    await prisma.activityLog.createMany({ data: logs });
    console.log(`Created ${logs.length} Activity Logs`);
}

main().finally(() => prisma.$disconnect());
