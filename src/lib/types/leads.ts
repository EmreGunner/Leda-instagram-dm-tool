export interface Lead {
    id: string;
    igUserId: string;
    igUsername: string;
    fullName?: string;
    bio?: string;
    profilePicUrl?: string;
    followerCount?: number;
    followingCount?: number;
    postCount?: number;
    isVerified: boolean;
    isPrivate: boolean;
    isBusiness: boolean;
    status: 'new' | 'contacted' | 'replied' | 'converted' | 'unsubscribed';
    tags: string[];
    matchedKeywords: string[];
    source: string;
    sourceQuery?: string;
    createdAt: string;
    // Enhanced fields
    leadScore?: number;
    engagementRate?: number;
    accountAge?: number;
    postFrequency?: number;
    email?: string;
    phone?: string;
    website?: string;
    location?: string;
    timesContacted?: number;
    lastContactedAt?: string;
    lastInteractionAt?: string;
    // New fields for Turkish real estate
    listingType?: 'Sale' | 'Rent' | null;
    propertyType?: string;
    propertySubType?: string;
    city?: string;
    town?: string;
    commentCount?: number;
    notes?: string;
    postLink?: string;
    postCaption?: string;
    commentDate?: string;
    commentLink?: string;
}

export interface InstagramAccount {
    id: string;
    igUserId: string;
    igUsername: string;
}

export const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    new: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'New' },
    contacted: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Contacted' },
    replied: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Replied' },
    converted: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Converted' },
    unsubscribed: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Unsubscribed' },
};

export const KEYWORD_PRESETS = [
    {
        name: 'E-commerce Founders',
        keywords: ['ecommerce founder', 'e-commerce founder', 'shopify', 'ecom', 'dropshipping', 'amazon fba', 'online store', 'dtc brand', 'd2c'],
        icon: '🛒',
    },
    {
        name: 'AI / Tech Influencers',
        keywords: ['ai influencer', 'ai founder', 'tech founder', 'artificial intelligence', 'machine learning', 'saas founder', 'startup founder', 'tech entrepreneur'],
        icon: '🤖',
    },
    {
        name: 'Business Coaches',
        keywords: ['business coach', 'life coach', 'executive coach', 'mentor', 'consultant', 'coaching', 'helping entrepreneurs'],
        icon: '📈',
    },
    {
        name: 'Content Creators',
        keywords: ['content creator', 'digital creator', 'youtuber', 'podcaster', 'influencer', 'ugc creator', 'brand ambassador'],
        icon: '🎬',
    },
    {
        name: 'Agency Owners',
        keywords: ['agency owner', 'marketing agency', 'digital agency', 'smma', 'social media manager', 'ad agency', 'creative agency'],
        icon: '🏢',
    },
    {
        name: 'Real Estate',
        keywords: ['real estate', 'realtor', 'real estate agent', 'property investor', 'real estate investor', 'broker'],
        icon: '🏠',
    },
    {
        name: 'Fitness / Health',
        keywords: ['fitness coach', 'personal trainer', 'nutritionist', 'health coach', 'wellness', 'gym owner', 'fitness influencer'],
        icon: '💪',
    },
    {
        name: 'General Entrepreneurs',
        keywords: ['founder', 'ceo', 'entrepreneur', 'business owner', 'startup', 'co-founder', 'building', 'bootstrapped'],
        icon: '🚀',
    },
];
