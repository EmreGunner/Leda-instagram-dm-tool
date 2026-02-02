import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/server/prisma/client';
import { faker } from '@faker-js/faker';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        // BYPASS AUTH FOR DEBUG SEEDING
        // In production, add a SECRET_KEY check here.

        // Find first workspace to dump leads into
        // const { data: userData } = await supabase
        //   .from('workspaces')
        //   .select('id')
        //   .limit(1)
        //   .single();

        // Or just find a user to get workspace
        // For safety let's just get the first workspace
        const workspace = await prisma.workspace.findFirst();

        if (!workspace) {
            return NextResponse.json({ success: false, error: 'No workspace found to seed into' }, { status: 404 });
        }

        const workspaceId = workspace.id;

        console.log('[Seed] Starting generation of 4000 leads...');

        const leads = [];
        const batchSize = 100;
        const totalLeads = 4000;

        // Keywords to cycle through
        const keywords = ['fiyat nedir', 'fiyat?', 'kac para', 'dm lutfen', 'konum neresi', 'detay alabilir miyim', 'yer nerede', 'daire fiyati'];

        for (let i = 0; i < totalLeads; i++) {
            const isTurkish = Math.random() > 0.1; // 90% Turkish names for realism given keywords
            const firstName = isTurkish ? faker.person.firstName('female') : faker.person.firstName(); // Skew female for insta demographics? or mixed.
            const lastName = isTurkish ? faker.person.lastName('female') : faker.person.lastName();
            const username = faker.internet.username({ firstName, lastName }).toLowerCase().replace(/[^a-z0-9_]/g, '') + Math.floor(Math.random() * 100);

            leads.push({
                igUserId: faker.string.numeric(10),
                igUsername: username,
                fullName: `${firstName} ${lastName}`,
                profilePicUrl: faker.image.avatar(),
                workspaceId: workspaceId,
                status: 'new',
                source: 'auto-comment-mining',
                sourceQuery: 'competitor_monitoring',
                matchedKeywords: [keywords[Math.floor(Math.random() * keywords.length)]],
                notes: `Auto-found comment on recent post.`,
                createdAt: faker.date.recent({ days: 7 })
            });
        }

        // Bulk insert is not directly supported by Supabase JS in a way that maps perfectly to Prisma without raw query or loop,
        // but Prisma createMany is efficient.

        // We'll use Prisma since we have the client logic setup
        // Note: 'matchedKeywords' is a string[] array, Prisma supports it on Postgres.

        let count = 0;
        for (let i = 0; i < leads.length; i += batchSize) {
            const batch = leads.slice(i, i + batchSize);
            await prisma.lead.createMany({
                data: batch,
                skipDuplicates: true
            });
            count += batch.length;
            console.log(`[Seed] Inserted ${count} / ${totalLeads}`);
        }

        return NextResponse.json({ success: true, count: count });

    } catch (error: any) {
        console.error('[Seed Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
