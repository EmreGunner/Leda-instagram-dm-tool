import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const lists = await prisma.leadList.findMany({
      where: { workspaceId: auth.workspaceId },
      include: {
        members: {
          include: {
            lead: {
              select: {
                id: true,
                igUsername: true,
                fullName: true,
                profilePicUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, lists });
  } catch (error: any) {
    console.error('Error fetching lead lists:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch lead lists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { name, description, filterKeywords, autoAdd } = await request.json() as {
      name: string;
      description?: string;
      filterKeywords?: string[];
      autoAdd?: boolean;
    };

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'List name is required' },
        { status: 400 }
      );
    }

    const list = await prisma.leadList.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        description,
        filterKeywords: filterKeywords || [],
        autoAdd: autoAdd || false,
      },
    });

    return NextResponse.json({ success: true, list });
  } catch (error: any) {
    console.error('Error creating lead list:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create lead list' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

