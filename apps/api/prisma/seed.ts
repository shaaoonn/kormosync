// ============================================================
// Prisma Seed Script - Default App Categories
// Run: npx ts-node prisma/seed.ts
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultCategories = [
    // PRODUCTIVE - Development & Coding
    { appPattern: 'code', category: 'PRODUCTIVE', label: 'VS Code' },
    { appPattern: 'visual studio', category: 'PRODUCTIVE', label: 'Visual Studio' },
    { appPattern: 'intellij', category: 'PRODUCTIVE', label: 'IntelliJ IDEA' },
    { appPattern: 'webstorm', category: 'PRODUCTIVE', label: 'WebStorm' },
    { appPattern: 'pycharm', category: 'PRODUCTIVE', label: 'PyCharm' },
    { appPattern: 'sublime', category: 'PRODUCTIVE', label: 'Sublime Text' },
    { appPattern: 'atom', category: 'PRODUCTIVE', label: 'Atom' },
    { appPattern: 'notepad++', category: 'PRODUCTIVE', label: 'Notepad++' },
    { appPattern: 'vim', category: 'PRODUCTIVE', label: 'Vim' },
    { appPattern: 'cursor', category: 'PRODUCTIVE', label: 'Cursor' },

    // PRODUCTIVE - Terminal & DevTools
    { appPattern: 'terminal', category: 'PRODUCTIVE', label: 'Terminal' },
    { appPattern: 'powershell', category: 'PRODUCTIVE', label: 'PowerShell' },
    { appPattern: 'cmd', category: 'PRODUCTIVE', label: 'Command Prompt' },
    { appPattern: 'windowsterminal', category: 'PRODUCTIVE', label: 'Windows Terminal' },
    { appPattern: 'iterm', category: 'PRODUCTIVE', label: 'iTerm' },
    { appPattern: 'warp', category: 'PRODUCTIVE', label: 'Warp' },
    { appPattern: 'postman', category: 'PRODUCTIVE', label: 'Postman' },
    { appPattern: 'insomnia', category: 'PRODUCTIVE', label: 'Insomnia' },
    { appPattern: 'docker', category: 'PRODUCTIVE', label: 'Docker' },
    { appPattern: 'github', category: 'PRODUCTIVE', label: 'GitHub Desktop' },

    // PRODUCTIVE - Design
    { appPattern: 'figma', category: 'PRODUCTIVE', label: 'Figma' },
    { appPattern: 'photoshop', category: 'PRODUCTIVE', label: 'Photoshop' },
    { appPattern: 'illustrator', category: 'PRODUCTIVE', label: 'Illustrator' },
    { appPattern: 'xd', category: 'PRODUCTIVE', label: 'Adobe XD' },
    { appPattern: 'sketch', category: 'PRODUCTIVE', label: 'Sketch' },
    { appPattern: 'canva', category: 'PRODUCTIVE', label: 'Canva' },
    { appPattern: 'affinity', category: 'PRODUCTIVE', label: 'Affinity' },

    // PRODUCTIVE - Office & Docs
    { appPattern: 'excel', category: 'PRODUCTIVE', label: 'Excel' },
    { appPattern: 'word', category: 'PRODUCTIVE', label: 'Word' },
    { appPattern: 'powerpoint', category: 'PRODUCTIVE', label: 'PowerPoint' },
    { appPattern: 'onenote', category: 'PRODUCTIVE', label: 'OneNote' },
    { appPattern: 'notion', category: 'PRODUCTIVE', label: 'Notion' },
    { appPattern: 'obsidian', category: 'PRODUCTIVE', label: 'Obsidian' },
    { appPattern: 'google docs', category: 'PRODUCTIVE', label: 'Google Docs' },
    { appPattern: 'google sheets', category: 'PRODUCTIVE', label: 'Google Sheets' },

    // PRODUCTIVE - Communication (Work)
    { appPattern: 'slack', category: 'PRODUCTIVE', label: 'Slack' },
    { appPattern: 'teams', category: 'PRODUCTIVE', label: 'Microsoft Teams' },
    { appPattern: 'zoom', category: 'PRODUCTIVE', label: 'Zoom' },
    { appPattern: 'google meet', category: 'PRODUCTIVE', label: 'Google Meet' },
    { appPattern: 'discord', category: 'NEUTRAL', label: 'Discord' },

    // PRODUCTIVE - Browsers (default neutral, specific sites matter more)
    { appPattern: 'chrome', category: 'NEUTRAL', label: 'Google Chrome' },
    { appPattern: 'firefox', category: 'NEUTRAL', label: 'Firefox' },
    { appPattern: 'msedge', category: 'NEUTRAL', label: 'Microsoft Edge' },
    { appPattern: 'brave', category: 'NEUTRAL', label: 'Brave' },
    { appPattern: 'safari', category: 'NEUTRAL', label: 'Safari' },
    { appPattern: 'opera', category: 'NEUTRAL', label: 'Opera' },

    // PRODUCTIVE - Project Management
    { appPattern: 'jira', category: 'PRODUCTIVE', label: 'Jira' },
    { appPattern: 'trello', category: 'PRODUCTIVE', label: 'Trello' },
    { appPattern: 'asana', category: 'PRODUCTIVE', label: 'Asana' },
    { appPattern: 'linear', category: 'PRODUCTIVE', label: 'Linear' },
    { appPattern: 'clickup', category: 'PRODUCTIVE', label: 'ClickUp' },

    // PRODUCTIVE - Database
    { appPattern: 'pgadmin', category: 'PRODUCTIVE', label: 'pgAdmin' },
    { appPattern: 'dbeaver', category: 'PRODUCTIVE', label: 'DBeaver' },
    { appPattern: 'mongodb compass', category: 'PRODUCTIVE', label: 'MongoDB Compass' },
    { appPattern: 'datagrip', category: 'PRODUCTIVE', label: 'DataGrip' },
    { appPattern: 'tableplus', category: 'PRODUCTIVE', label: 'TablePlus' },

    // UNPRODUCTIVE - Social Media
    { appPattern: 'facebook', category: 'UNPRODUCTIVE', label: 'Facebook' },
    { appPattern: 'instagram', category: 'UNPRODUCTIVE', label: 'Instagram' },
    { appPattern: 'twitter', category: 'UNPRODUCTIVE', label: 'Twitter/X' },
    { appPattern: 'tiktok', category: 'UNPRODUCTIVE', label: 'TikTok' },
    { appPattern: 'snapchat', category: 'UNPRODUCTIVE', label: 'Snapchat' },
    { appPattern: 'reddit', category: 'UNPRODUCTIVE', label: 'Reddit' },
    { appPattern: 'pinterest', category: 'UNPRODUCTIVE', label: 'Pinterest' },
    { appPattern: 'tumblr', category: 'UNPRODUCTIVE', label: 'Tumblr' },

    // UNPRODUCTIVE - Entertainment
    { appPattern: 'netflix', category: 'UNPRODUCTIVE', label: 'Netflix' },
    { appPattern: 'youtube', category: 'UNPRODUCTIVE', label: 'YouTube' },
    { appPattern: 'spotify', category: 'UNPRODUCTIVE', label: 'Spotify' },
    { appPattern: 'vlc', category: 'NEUTRAL', label: 'VLC Player' },
    { appPattern: 'twitch', category: 'UNPRODUCTIVE', label: 'Twitch' },

    // UNPRODUCTIVE - Gaming
    { appPattern: 'steam', category: 'UNPRODUCTIVE', label: 'Steam' },
    { appPattern: 'epicgames', category: 'UNPRODUCTIVE', label: 'Epic Games' },
    { appPattern: 'minecraft', category: 'UNPRODUCTIVE', label: 'Minecraft' },
    { appPattern: 'valorant', category: 'UNPRODUCTIVE', label: 'Valorant' },
    { appPattern: 'league of legends', category: 'UNPRODUCTIVE', label: 'League of Legends' },

    // UNPRODUCTIVE - Messaging (Personal)
    { appPattern: 'whatsapp', category: 'UNPRODUCTIVE', label: 'WhatsApp' },
    { appPattern: 'telegram', category: 'UNPRODUCTIVE', label: 'Telegram' },
    { appPattern: 'messenger', category: 'UNPRODUCTIVE', label: 'Messenger' },
    { appPattern: 'viber', category: 'UNPRODUCTIVE', label: 'Viber' },
    { appPattern: 'imo', category: 'UNPRODUCTIVE', label: 'IMO' },

    // NEUTRAL - System
    { appPattern: 'explorer', category: 'NEUTRAL', label: 'File Explorer' },
    { appPattern: 'finder', category: 'NEUTRAL', label: 'Finder' },
    { appPattern: 'settings', category: 'NEUTRAL', label: 'Settings' },
    { appPattern: 'calculator', category: 'NEUTRAL', label: 'Calculator' },
    { appPattern: 'taskmanager', category: 'NEUTRAL', label: 'Task Manager' },
];

async function main() {
    console.log('Seeding default AppCategory entries...');

    for (const cat of defaultCategories) {
        // Upsert: check if a global (companyId=null) entry with this pattern already exists
        const existing = await prisma.appCategory.findFirst({
            where: {
                companyId: null,
                appPattern: cat.appPattern,
            },
        });

        if (existing) {
            // Update existing
            await prisma.appCategory.update({
                where: { id: existing.id },
                data: { category: cat.category, label: cat.label },
            });
            console.log(`  Updated: ${cat.label} (${cat.appPattern}) -> ${cat.category}`);
        } else {
            // Create new
            await prisma.appCategory.create({
                data: {
                    companyId: null, // Global defaults
                    appPattern: cat.appPattern,
                    category: cat.category,
                    label: cat.label,
                },
            });
            console.log(`  Created: ${cat.label} (${cat.appPattern}) -> ${cat.category}`);
        }
    }

    console.log(`\nSeeded ${defaultCategories.length} default app categories.`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('Seed error:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
