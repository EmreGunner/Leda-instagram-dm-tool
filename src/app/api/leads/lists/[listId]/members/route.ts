import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { listId } = params;
    const { leadIds } = await request.json() as {
      leadIds: string[];
    };

    if (!leadIds || leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lead IDs are required' },
        { status: 400 }
      );
    }

    // Verify list belongs to workspace
    const list = await prisma.leadList.findFirst({
      where: {
        id: listId,
        workspaceId: auth.workspaceId,
      },
    });

    if (!list) {
      return NextResponse.json(
        { success: false, error: 'List not found' },
        { status: 404 }
      );
    }

    // Verify all leads belong to workspace
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

    // Add leads to list (skip if already exists)
    const members = await Promise.all(
      leadIds.map(leadId =>
        prisma.leadListMember.upsert({
          where: {
            leadListId_leadId: {
              leadListId: listId,
              leadId,
            },
          },
          create: {
            leadListId: listId,
            leadId,
          },
          update: {},
        })
      )
    );

    return NextResponse.json({ success: true, added: members.length });
  } catch (error: any) {
    console.error('Error adding leads to list:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add leads to list' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { listId } = params;
    const { leadIds } = await request.json() as {
      leadIds: string[];
    };

    if (!leadIds || leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lead IDs are required' },
        { status: 400 }
      );
    }

    // Verify list belongs to workspace
    const list = await prisma.leadList.findFirst({
      where: {
        id: listId,
        workspaceId: auth.workspaceId,
      },
    });

    if (!list) {
      return NextResponse.json(
        { success: false, error: 'List not found' },
        { status: 404 }
      );
    }

    await prisma.leadListMember.deleteMany({
      where: {
        leadListId: listId,
        leadId: { in: leadIds },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing leads from list:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove leads from list' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

