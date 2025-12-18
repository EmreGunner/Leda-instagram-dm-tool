import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { listId } = params;
    const { name, description, filterKeywords, autoAdd } = await request.json() as {
      name?: string;
      description?: string;
      filterKeywords?: string[];
      autoAdd?: boolean;
    };

    // Verify list belongs to workspace
    const existing = await prisma.leadList.findFirst({
      where: {
        id: listId,
        workspaceId: auth.workspaceId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'List not found' },
        { status: 404 }
      );
    }

    const list = await prisma.leadList.update({
      where: { id: listId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(filterKeywords !== undefined && { filterKeywords }),
        ...(autoAdd !== undefined && { autoAdd }),
      },
    });

    return NextResponse.json({ success: true, list });
  } catch (error: any) {
    console.error('Error updating lead list:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update lead list' },
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

    // Verify list belongs to workspace
    const existing = await prisma.leadList.findFirst({
      where: {
        id: listId,
        workspaceId: auth.workspaceId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'List not found' },
        { status: 404 }
      );
    }

    await prisma.leadList.delete({
      where: { id: listId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting lead list:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete lead list' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

