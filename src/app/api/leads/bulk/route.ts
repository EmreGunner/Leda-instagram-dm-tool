import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { leadService } from '@/lib/server/leads/lead-service';
import { prisma } from '@/lib/server/prisma/client';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { action, leadIds, data } = await request.json() as {
      action: 'updateStatus' | 'addTags' | 'removeTags' | 'updateNotes';
      leadIds: string[];
      data?: any;
    };

    if (!leadIds || leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leads selected' },
        { status: 400 }
      );
    }

    // Verify all leads belong to the workspace
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        workspaceId: auth.workspaceId,
      },
      select: { id: true },
    });

    if (leads.length !== leadIds.length) {
      return NextResponse.json(
        { success: false, error: 'Some leads not found or unauthorized' },
        { status: 403 }
      );
    }

    const validLeadIds = leads.map(l => l.id);

    let result: any;

    switch (action) {
      case 'updateStatus':
        if (!data?.status) {
          return NextResponse.json(
            { success: false, error: 'Status is required' },
            { status: 400 }
          );
        }
        const count = await leadService.bulkUpdateStatus(validLeadIds, data.status);
        result = { updated: count };
        break;

      case 'addTags':
        if (!data?.tags || !Array.isArray(data.tags) || data.tags.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Tags array is required' },
            { status: 400 }
          );
        }
        const taggedCount = await leadService.bulkAddTags(validLeadIds, data.tags);
        result = { updated: taggedCount };
        break;

      case 'removeTags':
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json(
            { success: false, error: 'Tags array is required' },
            { status: 400 }
          );
        }
        // Get current tags and remove specified ones
        const leadsWithTags = await prisma.lead.findMany({
          where: { id: { in: validLeadIds } },
          select: { id: true, tags: true },
        });

        const removeUpdates = leadsWithTags.map(lead => {
          const currentTags = lead.tags || [];
          const filteredTags = currentTags.filter(tag => !data.tags.includes(tag));
          return prisma.lead.update({
            where: { id: lead.id },
            data: { tags: filteredTags },
          });
        });

        await Promise.all(removeUpdates);
        result = { updated: leadsWithTags.length };
        break;

      case 'updateNotes':
        if (!data?.notes) {
          return NextResponse.json(
            { success: false, error: 'Notes are required' },
            { status: 400 }
          );
        }
        await prisma.lead.updateMany({
          where: { id: { in: validLeadIds } },
          data: { notes: data.notes },
        });
        result = { updated: validLeadIds.length };
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error in bulk lead action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to perform bulk action' },
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

