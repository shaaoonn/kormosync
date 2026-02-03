
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking Screenshot Records...");

    const count = await prisma.screenshot.count();
    console.log(`📊 Total Screenshots in DB: ${count}`);

    const allScreenshots = await prisma.screenshot.findMany({
        orderBy: { capturedAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, email: true } } }
    });

    console.log("📸 Last 10 Screenshots:");
    allScreenshots.forEach(s => {
        console.log(` - [${s.id}] User: ${s.user.email} | Time: ${s.capturedAt.toISOString()} | Local(approx): ${s.capturedAt.toLocaleString()}`);
    });

    // Check specifically for today (UTC vs Local)
    const now = new Date();
    const startOfUtcDay = new Date(now.toISOString().split('T')[0]);
    console.log(`\n🕒 Checking > ${startOfUtcDay.toISOString()} (UTC Start of Day)`);

    const todayScreenshots = await prisma.screenshot.count({
        where: { capturedAt: { gte: startOfUtcDay } }
    });
    console.log(`📅 Screenshots 'Today' (UTC): ${todayScreenshots}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
