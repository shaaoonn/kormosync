import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'mdahsanullahshaon@gmail.com';

    console.log(`Checking user: ${email}...`);

    const user = await prisma.user.findFirst({
        where: { email: email }
    });

    if (user) {
        console.log(`User found (ID: ${user.id}). Updating role to SUPER_ADMIN...`);
        await prisma.user.update({
            where: { id: user.id },
            data: { role: Role.SUPER_ADMIN }
        });
        console.log('✅ User role updated successfully.');
    } else {
        console.log('User not found. Creating placeholder Super Admin...');
        // Note: This user must sign up with this email on Firebase to actually login properly
        // We use a dummy firebaseUid that will likely need to be updated or handled on sign-up
        // However, usually, the user signs up FIRST. 
        // Since the user provided a password, they might expect me to create it. 
        // But I can't create it in Firebase.
        // I will create the DB record so IF they sign up, the backend might match by email (if logic exists)
        // OR they have already signed up and my findFirst failed? Unlikely if email matches.

        const newUser = await prisma.user.create({
            data: {
                email: email,
                name: "Ahsanullah Shaon",
                role: Role.SUPER_ADMIN,
                firebaseUid: `super-admin-placeholder-${Date.now()}`,
                isPublic: false
            }
        });
        console.log(`✅ Created Super Admin user with ID: ${newUser.id}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
