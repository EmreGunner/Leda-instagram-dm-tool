
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createClient();

    const { data: leads, error } = await supabase
        .from('leads')
        .select('ig_username, estate_category, notes, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
        message: "Debugging Lead Data",
        leads
    }, { status: 200 });
}
