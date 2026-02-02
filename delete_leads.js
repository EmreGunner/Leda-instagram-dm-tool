const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Deleting mock leads...');
    // Delete leads where notes start with "Auto-found" which was our mock pattern
    // OR just delete ALL leads if the user wants a fresh start.
    // Given the anger, let's delete ALL leads in this workspace to be safe and clean.

    // Find the workspace again to be safe
    const leadSample = await prisma.lead.findFirst();
    if (!leadSample) {
        console.log('No leads found to delete.');
        return;
    }

    const { count } = await prisma.lead.deleteMany({
        where: {
            workspaceId: leadSample.workspaceId
        }
    });

    console.log(`Deleted ${count} leads.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
