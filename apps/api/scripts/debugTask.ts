import { PrismaClient, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = "mdahsanullahshaon@gmail.com";
    const user = await prisma.user.findFirst({
        where: { email },
        include: { company: true }
    });

    if (!user) {
        console.log("User not found!");
        return;
    }

    console.log(`User found: ${user.name} (${user.role})`);
    console.log(`Company ID: ${user.companyId}`);

    let companyId = user.companyId;
    if (!companyId) {
        console.log("Creating test company for Super Admin...");
        const company = await prisma.company.create({
            data: {
                name: "Super Admin Test Corp",
                subscriptionStatus: "ACTIVE",
                // ownerId removed
            }
        });
        companyId = company.id;

        await prisma.user.update({
            where: { id: user.id },
            data: { companyId: company.id }
        });
        console.log("Assigned user to new company.");
    }

    // Check for existing tasks
    const tasks = await prisma.task.findMany({
        where: {
            companyId: companyId
        }
    });

    console.log(`Found ${tasks.length} tasks for this company.`);

    if (tasks.length === 0) {
        console.log("Creating a dummy task...");
        await prisma.task.create({
            data: {
                title: "Test Desktop Tracker",
                description: "Verify that screenshots are working",
                priority: "HIGH",
                status: TaskStatus.IN_PROGRESS,
                companyId: companyId!,
                creatorId: user.id,
                assignees: {
                    connect: { id: user.id }
                }
            }
        });
        console.log("Dummy task created!");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
