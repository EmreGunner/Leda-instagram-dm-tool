
import { prisma } from './src/lib/server/prisma/client';

async function checkDebugData() {
    console.log('--- Checking Automations ---');
    const automations = await prisma.automation.findMany();
    console.log(JSON.stringify(automations, null, 2));

    console.log('\n--- Checking JobQueue ---');
    const jobs = await prisma.jobQueue.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(jobs, null, 2));

    console.log('\n--- Checking Recent Messages ---');
    const messages = await prisma.message.findMany({
        orderBy: { created_at: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(messages.map(m => ({
        id: m.id,
        content: m.content,
        direction: m.direction,
        created_at: m.created_at
    })), null, 2));
}

checkDebugData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
