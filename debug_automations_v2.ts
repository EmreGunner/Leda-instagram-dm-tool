
import { prisma } from './src/lib/server/prisma/client';

async function checkDebugData() {
    console.log('--- Checking JobQueue ---');
    try {
        const jobs = await prisma.jobQueue.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        console.log(`Found ${jobs.length} jobs.`);
        if (jobs.length > 0) {
            console.log(JSON.stringify(jobs, null, 2));
        } else {
            console.log("No jobs found in JobQueue.");
        }
    } catch (e) {
        console.error("Error fetching jobs:", e);
    }

    console.log('\n--- Checking Messages ---');
    try {
        const messages = await prisma.message.findMany({
            orderBy: { created_at: 'desc' },
            take: 5
        });
        console.log(`Found ${messages.length} messages.`);
        console.log(JSON.stringify(messages.map(m => ({
            id: m.id,
            content: m.content,
            direction: m.direction,
            created_at: m.created_at
        })), null, 2));
    } catch (e) {
        console.error("Error fetching messages:", e);
    }
}

checkDebugData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
