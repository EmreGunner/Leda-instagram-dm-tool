import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { leadService } from '@/lib/server/leads/lead-service';
import { prisma } from '@/lib/server/prisma/client';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { leadIds } = await request.json() as {
      leadIds?: string[];
    };

    let leadIdsToExport: string[];

    if (leadIds && leadIds.length > 0) {
      // Verify all leads belong to the workspace
      const leads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          workspaceId: auth.workspaceId,
        },
        select: { id: true },
      });

      leadIdsToExport = leads.map(l => l.id);
    } else {
      // Export all leads for the workspace
      const leads = await prisma.lead.findMany({
        where: { workspaceId: auth.workspaceId },
        select: { id: true },
      });

      leadIdsToExport = leads.map(l => l.id);
    }

    if (leadIdsToExport.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leads to export' },
        { status: 400 }
      );
    }

    const csvContent = await leadService.exportLeadsToCSV(leadIdsToExport);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting leads:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to export leads' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

