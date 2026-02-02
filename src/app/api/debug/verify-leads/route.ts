import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/server/prisma/client';

export async function GET(req: NextRequest) {
    const supabase = await createClient();

    // 1. Check Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated with Supabase' }, { status: 401 });
    }

    // 2. Query via Supabase (RLS applied)
    const { count: supabaseCount, error: supabaseError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

    // 3. Query via Prisma (Bypasses RLS)
    // Find matches for this user's workspace
    // We need to find the user's workspace first
    const { data: userData } = await supabase.from('users').select('workspaceId').eq('supabaseAuthId', user.id).single();

    let prismaCount = -1;
    let workspaceId = 'unknown';

    if (userData) {
        workspaceId = userData.workspaceId;
        prismaCount = await prisma.lead.count({
            where: { workspaceId: userData.workspaceId }
        });
    }

    return NextResponse.json({
        user: user.email,
        workspaceId: workspaceId,
        supabaseCount: supabaseCount, // RLS Visible
        prismaCount: prismaCount,     // Actual DB Count
        supabaseError: supabaseError,
        difference: (prismaCount - (supabaseCount || 0))
    });
}
