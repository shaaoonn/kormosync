import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const inviteToken = '2894c6f6-869c-4751-a6dc-63f0a8489d43';
    const email = 'ejobsit.com@gmail.com';

    // Find the invite by token
    const invite = await prisma.invite.findUnique({
        where: { token: inviteToken },
        include: { company: true }
    });

    if (!invite) {
        console.log('❌ Invite not found with token:', inviteToken);

        // List all invites to help debug
        const allInvites = await prisma.invite.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' }
        });
        console.log('Recent invites:');
        allInvites.forEach(i => console.log(`  Token: ${i.token}, Company: ${i.companyId}`));
        return;
    }

    console.log('✅ Invite found for company:', invite.company?.name || invite.companyId);

    // Check if user already exists
    let user = await prisma.user.findFirst({
        where: { email: email }
    });

    if (user) {
        console.log('👤 User already exists:', user.id);
        // Update user to join this company
        await prisma.user.update({
            where: { id: user.id },
            data: {
                companyId: invite.companyId,
                role: 'EMPLOYEE'
            }
        });
        console.log('✅ User updated to join company');
    } else {
        // Create new user
        user = await prisma.user.create({
            data: {
                email: email,
                name: 'Ejobsit User',
                phoneNumber: '+8801700000000',
                role: 'EMPLOYEE',
                companyId: invite.companyId,
                firebaseUid: 'manual-test-ejobsit-' + Date.now()
            }
        });
        console.log('✅ User created:', user.id);
    }

    console.log('🎉 Done! User is now part of company:', invite.company?.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
