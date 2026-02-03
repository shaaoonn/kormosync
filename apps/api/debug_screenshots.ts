import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const screenshots = await prisma.screenshot.findMany({
        take: 5,
        orderBy: { recordedAt: 'desc' }
    });

    console.log("Recent Screenshots:");
    screenshots.forEach(s => {
        console.log(`ID: ${s.id}, Path: "${s.screenshotPath}", RecordedAt: ${s.recordedAt}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
