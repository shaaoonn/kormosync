import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Add test attachments to the task
    const updated = await prisma.task.update({
        where: { id: 'de512659-f893-4662-8ded-cbf4863195fb' },
        data: {
            attachments: [
                'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg',
                'https://www.africau.edu/images/default/sample.pdf'
            ],
            videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
        }
    });
    console.log('✅ Added test files to task:', updated.title);
    console.log('Attachments:', updated.attachments);
    console.log('Video:', updated.videoUrl);
}

main().then(() => prisma.$disconnect());
