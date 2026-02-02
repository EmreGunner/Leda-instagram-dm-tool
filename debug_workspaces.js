const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({ include: { workspace: true } });
    console.log('--- USERS ---');
    users.forEach(u => console.log(`User: ${u.email}, Workspace: ${u.workspaceId} (${u.workspace?.name})`));

    const workspaces = await prisma.workspace.findMany();
    console.log('--- WORKSPACES ---');
    workspaces.forEach(w => console.log(`Workspace: ${w.id} (${w.name})`));

    const leadCount = await prisma.lead.count();
    const leadSample = await prisma.lead.findFirst();
    console.log(`--- LEADS ---`);
    console.log(`Total: ${leadCount}`);
    if (leadSample) {
        console.log(`Sample Lead Workspace: ${leadSample.workspaceId}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
