
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const update = await prisma.company.updateMany({
            data: {
                subscriptionStatus: 'INACTIVE',
                // Clear any future date
                subscriptionEndDate: null
            }
        });
        console.log(`✅ Downgraded ${update.count} companies to INACTIVE.`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
