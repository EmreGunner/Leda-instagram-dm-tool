import { prisma } from '@/lib/server/prisma/client';

export interface LeadScoringFactors {
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  isVerified?: boolean;
  isBusiness?: boolean;
  isPrivate?: boolean;
  engagementRate?: number;
  accountAge?: number;
  postFrequency?: number;
  matchedKeywords?: string[];
  bio?: string;
}

export interface LeadEnrichmentData {
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  engagementRate?: number;
  accountAge?: number;
  postFrequency?: number;
}

export class LeadService {
  /**
   * Calculate AI-powered lead score (0-100)
   * Factors:
   * - Profile quality (verified, business account)
   * - Engagement metrics (follower ratio, engagement rate)
   * - Account maturity (age, post frequency)
   * - Match quality (keyword matches, bio relevance)
   */
  calculateLeadScore(factors: LeadScoringFactors): number {
    let score = 0;
    const maxScore = 100;

    // Profile quality (20 points)
    if (factors.isVerified) score += 10;
    if (factors.isBusiness) score += 10;
    if (factors.isPrivate) score -= 5; // Private accounts are harder to engage

    // Engagement metrics (30 points)
    if (factors.followerCount && factors.followingCount) {
      const followerRatio = factors.followerCount / Math.max(factors.followingCount, 1);
      // Higher follower ratio = better (influencer/authority)
      score += Math.min(15, (followerRatio / 10) * 15);
    }

    if (factors.engagementRate) {
      // Engagement rate scoring: 0-5% = 0-15 points
      score += Math.min(15, (factors.engagementRate / 5) * 15);
    }

    // Account maturity (20 points)
    if (factors.accountAge) {
      // Older accounts are more trustworthy
      const ageScore = Math.min(10, (factors.accountAge / 365) * 10);
      score += ageScore;
    }

    if (factors.postFrequency) {
      // Active accounts (2-7 posts/week) score higher
      const frequencyScore = factors.postFrequency >= 2 && factors.postFrequency <= 7 
        ? 10 
        : Math.max(0, 10 - Math.abs(factors.postFrequency - 4.5));
      score += frequencyScore;
    }

    // Match quality (30 points)
    if (factors.matchedKeywords && factors.matchedKeywords.length > 0) {
      // More keyword matches = higher score
      score += Math.min(20, factors.matchedKeywords.length * 5);
    }

    if (factors.bio && factors.bio.length > 50) {
      // Detailed bios indicate serious accounts
      score += 10;
    }

    // Follower count bonus (up to 10 points)
    if (factors.followerCount) {
      // Sweet spot: 1K-100K followers
      if (factors.followerCount >= 1000 && factors.followerCount <= 100000) {
        score += 10;
      } else if (factors.followerCount > 100000) {
        score += 5; // Very large accounts might be harder to reach
      }
    }

    return Math.max(0, Math.min(maxScore, Math.round(score)));
  }

  /**
   * Calculate engagement rate from follower and post data
   * Simplified calculation: assumes average engagement
   */
  calculateEngagementRate(followerCount?: number, postCount?: number): number | null {
    if (!followerCount || followerCount === 0) return null;
    
    // Estimate engagement rate based on follower count
    // Typical engagement rates: 1-3% for accounts with 10K+ followers
    // Higher for smaller accounts
    if (followerCount < 1000) return 5.0; // Small accounts have higher engagement
    if (followerCount < 10000) return 3.0;
    if (followerCount < 100000) return 2.0;
    return 1.0; // Large accounts have lower engagement
  }

  /**
   * Calculate account age in days
   */
  calculateAccountAge(createdAt?: Date): number | null {
    if (!createdAt) return null;
    const now = new Date();
    const diffTime = now.getTime() - createdAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate post frequency (posts per week)
   */
  calculatePostFrequency(postCount?: number, accountAge?: number): number | null {
    if (!postCount || !accountAge || accountAge === 0) return null;
    const weeks = accountAge / 7;
    return weeks > 0 ? postCount / weeks : null;
  }

  /**
   * Enrich lead data from profile information
   * Extracts email, phone, website from bio and external URL
   */
  enrichLeadData(bio?: string, externalUrl?: string): LeadEnrichmentData {
    const enrichment: LeadEnrichmentData = {};

    if (externalUrl) {
      enrichment.website = externalUrl;
    }

    if (bio) {
      // Extract email from bio
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emailMatch = bio.match(emailRegex);
      if (emailMatch && emailMatch.length > 0) {
        enrichment.email = emailMatch[0];
      }

      // Extract phone from bio (basic patterns)
      const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const phoneMatch = bio.match(phoneRegex);
      if (phoneMatch && phoneMatch.length > 0) {
        enrichment.phone = phoneMatch[0];
      }

      // Extract location hints (basic - could be improved with NLP)
      const locationKeywords = ['NYC', 'LA', 'London', 'Paris', 'Berlin', 'Tokyo', 'Dubai'];
      for (const keyword of locationKeywords) {
        if (bio.includes(keyword)) {
          enrichment.location = keyword;
          break;
        }
      }
    }

    return enrichment;
  }

  /**
   * Check if a lead is a duplicate based on ig_user_id and workspace
   */
  async findDuplicateLead(igUserId: string, workspaceId: string): Promise<string | null> {
    const existing = await prisma.lead.findUnique({
      where: {
        igUserId_workspaceId: {
          igUserId,
          workspaceId,
        },
      },
      select: { id: true },
    });

    return existing?.id || null;
  }

  /**
   * Update lead with scoring and enrichment data
   */
  async updateLeadWithScoring(
    leadId: string,
    factors: LeadScoringFactors,
    enrichment?: LeadEnrichmentData
  ): Promise<void> {
    const score = this.calculateLeadScore(factors);
    const engagementRate = enrichment?.engagementRate || this.calculateEngagementRate(
      factors.followerCount,
      factors.postCount
    );
    const accountAge = enrichment?.accountAge || factors.accountAge;
    const postFrequency = enrichment?.postFrequency || this.calculatePostFrequency(
      factors.postCount,
      accountAge || undefined
    );

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        leadScore: score,
        engagementRate,
        accountAge,
        postFrequency,
        email: enrichment?.email,
        phone: enrichment?.phone,
        website: enrichment?.website,
        location: enrichment?.location,
      },
    });
  }

  /**
   * Track lead interaction (contact, reply, etc.)
   */
  async trackLeadInteraction(
    leadId: string,
    interactionType: 'contacted' | 'replied' | 'converted'
  ): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { timesContacted: true },
    });

    const updateData: any = {
      lastInteractionAt: new Date(),
    };

    if (interactionType === 'contacted') {
      updateData.timesContacted = (lead?.timesContacted || 0) + 1;
      updateData.lastContactedAt = new Date();
      updateData.dmSentAt = new Date();
    } else if (interactionType === 'replied') {
      updateData.dmRepliedAt = new Date();
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });
  }

  /**
   * Bulk update lead statuses
   */
  async bulkUpdateStatus(leadIds: string[], status: string): Promise<number> {
    const result = await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { status },
    });
    return result.count;
  }

  /**
   * Bulk add tags to leads
   */
  async bulkAddTags(leadIds: string[], tags: string[]): Promise<number> {
    // Get current tags for all leads
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, tags: true },
    });

    // Update each lead with merged tags
    const updates = leads.map(lead => {
      const currentTags = lead.tags || [];
      const mergedTags = Array.from(new Set([...currentTags, ...tags]));
      return prisma.lead.update({
        where: { id: lead.id },
        data: { tags: mergedTags },
      });
    });

    await Promise.all(updates);
    return leads.length;
  }

  /**
   * Export leads to CSV format
   */
  async exportLeadsToCSV(leadIds: string[]): Promise<string> {
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: {
        igUsername: true,
        fullName: true,
        bio: true,
        followerCount: true,
        followingCount: true,
        postCount: true,
        isVerified: true,
        isBusiness: true,
        status: true,
        tags: true,
        leadScore: true,
        engagementRate: true,
        email: true,
        phone: true,
        website: true,
        location: true,
        source: true,
        matchedKeywords: true,
        createdAt: true,
      },
    });

    // CSV header
    const headers = [
      'Username',
      'Full Name',
      'Bio',
      'Followers',
      'Following',
      'Posts',
      'Verified',
      'Business',
      'Status',
      'Tags',
      'Lead Score',
      'Engagement Rate',
      'Email',
      'Phone',
      'Website',
      'Location',
      'Source',
      'Matched Keywords',
      'Created At',
    ];

    // CSV rows
    const rows = leads.map(lead => [
      lead.igUsername,
      lead.fullName || '',
      (lead.bio || '').replace(/"/g, '""'), // Escape quotes
      lead.followerCount || '',
      lead.followingCount || '',
      lead.postCount || '',
      lead.isVerified ? 'Yes' : 'No',
      lead.isBusiness ? 'Yes' : 'No',
      lead.status,
      (lead.tags || []).join('; '),
      lead.leadScore || '',
      lead.engagementRate ? `${lead.engagementRate.toFixed(2)}%` : '',
      lead.email || '',
      lead.phone || '',
      lead.website || '',
      lead.location || '',
      lead.source || '',
      (lead.matchedKeywords || []).join('; '),
      lead.createdAt.toISOString(),
    ]);

    // Combine header and rows
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }
}

export const leadService = new LeadService();

