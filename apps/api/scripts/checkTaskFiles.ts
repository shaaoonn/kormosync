import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const task = await prisma.task.findFirst({
        where: { title: { contains: 'মনির' } },
        select: {
            id: true,
            title: true,
            attachments: true,
            videoUrl: true,
            descriptionRaw: true
        }
    });

    console.log('Task:', JSON.stringify(task, null, 2));

    if (task?.attachments?.length === 0) {
        console.log('\n⚠️ No attachments found! This task was created without files.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
