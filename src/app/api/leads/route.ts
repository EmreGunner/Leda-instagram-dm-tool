import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma/client';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status');
        const sort = searchParams.get('sort') || 'newest';

        const where: Prisma.LeadWhereInput = {
            workspaceId: 'default', // Using camelCase property as per generated client
        };

        if (search) {
            where.OR = [
                { igUsername: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
                { bio: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (status) {
            where.status = status;
        }

        // Determine sort order
        let orderBy: Prisma.LeadOrderByWithRelationInput = { createdAt: 'desc' };
        if (sort === 'oldest') orderBy = { createdAt: 'asc' };
        if (sort === 'score_desc' || sort === 'score') orderBy = { leadScore: 'desc' };
        if (sort === 'score_asc') orderBy = { leadScore: 'asc' };
        // Default 'newest' is createdAt desc


        const leads = await prisma.lead.findMany({
            where,
            take: limit,
            skip: (page - 1) * limit,
            orderBy,
            select: {
                id: true,
                igUsername: true,
                fullName: true,
                profilePicUrl: true,
                isVerified: true,
                isPrivate: true,
                isBusiness: true,
                followerCount: true,
                followingCount: true,
                postCount: true,
                bio: true,
                externalUrl: true,
                status: true,
                tags: true,
                source: true,
                sourceQuery: true,
                matchedKeywords: true,
                leadScore: true,
                engagementRate: true,
                accountAge: true,
                postFrequency: true,
                lastInteractionAt: true,
                createdAt: true,
                // New columns
                listingType: true,
                propertyType: true,
                propertySubType: true,
                city: true,
                town: true,
                commentDate: true,
                postLink: true,
                commentLink: true,
                postCaption: true,
                notes: true,
                // Metrics
                timesContacted: true,
                lastContactedAt: true,
                email: true,
                phone: true,
                website: true,
                location: true,
            },
        });

        return NextResponse.json(leads);
    } catch (error) {
        console.error('Error fetching leads:', error);
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }
}
