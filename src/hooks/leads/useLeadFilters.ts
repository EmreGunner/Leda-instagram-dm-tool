import { useState, useMemo } from 'react';
import { Lead } from '@/lib/types/leads';

// Smart keyword matching function
function matchKeywordsInBio(bio: string, keywords: string[]): string[] {
    const lowerBio = bio.toLowerCase();
    const matched: string[] = [];

    for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase().trim();
        if (!lowerKeyword) continue;

        // Check for exact phrase match
        if (lowerBio.includes(lowerKeyword)) {
            matched.push(keyword);
            continue;
        }

        // Check for word-by-word match (for multi-word phrases)
        const words = lowerKeyword.split(' ').filter(w => w.length > 2);
        if (words.length > 1) {
            const allWordsPresent = words.every(word => lowerBio.includes(word));
            if (allWordsPresent) {
                matched.push(keyword);
            }
        }
    }

    return Array.from(new Set(matched)); // Remove duplicates
}

export function useLeadFilters(leads: Lead[]) {
    // Basic filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('newest');
    const [leadsSearchQuery, setLeadsSearchQuery] = useState('');

    // Advanced filters state
    const [bioKeywords, setBioKeywords] = useState(''); // Comma separated
    const [followerRange, setFollowerRange] = useState<[number, number] | null>(null);
    const [engagementRateRange, setEngagementRateRange] = useState<[number, number] | null>(null);
    const [accountAgeRange, setAccountAgeRange] = useState<[number, number] | null>(null);
    const [postFrequencyRange, setPostFrequencyRange] = useState<[number, number] | null>(null);
    const [minLeadScore, setMinLeadScore] = useState<number | null>(null);
    const [estateCategoryFilter, setEstateCategoryFilter] = useState<string>('all');
    const [cityFilter, setCityFilter] = useState<string>('all');
    const [captionSearchTerm, setCaptionSearchTerm] = useState('');
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

    // Derived state
    const filterKeywords = useMemo(() =>
        bioKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0),
        [bioKeywords]);

    // Get unique cities for filter
    const uniqueCities = useMemo(() => {
        const cities = new Set<string>();
        leads.forEach(l => {
            if (l.city) cities.add(l.city);
        });
        return Array.from(cities).sort();
    }, [leads]);

    // Filter, search, and sort leads
    const processedLeads = useMemo(() => leads
        .filter(lead => {
            // Status filter
            if (statusFilter !== 'all' && lead.status !== statusFilter) return false;

            // Bio keywords filter
            if (filterKeywords.length > 0) {
                const bio = (lead.bio || '').toLowerCase();
                if (!filterKeywords.some(k => bio.includes(k.toLowerCase()))) return false;
            }

            // Search query filter
            if (leadsSearchQuery) {
                const query = leadsSearchQuery.toLowerCase();
                const matchesUsername = lead.igUsername?.toLowerCase().includes(query);
                const matchesName = lead.fullName?.toLowerCase().includes(query);
                const matchesBio = lead.bio?.toLowerCase().includes(query);
                const matchesTags = lead.matchedKeywords?.some(k => k.toLowerCase().includes(query));
                if (!matchesUsername && !matchesName && !matchesBio && !matchesTags) return false;
            }

            // Advanced filters
            if (followerRange) {
                const followers = lead.followerCount || 0;
                if (followers < followerRange[0] || followers > followerRange[1]) return false;
            }

            if (engagementRateRange && lead.engagementRate !== undefined && lead.engagementRate !== null) {
                if (lead.engagementRate < engagementRateRange[0] || lead.engagementRate > engagementRateRange[1]) return false;
            }

            if (accountAgeRange && lead.accountAge !== undefined && lead.accountAge !== null) {
                if (lead.accountAge < accountAgeRange[0] || lead.accountAge > accountAgeRange[1]) return false;
            }

            if (postFrequencyRange && lead.postFrequency !== undefined && lead.postFrequency !== null) {
                if (lead.postFrequency < postFrequencyRange[0] || lead.postFrequency > postFrequencyRange[1]) return false;
            }

            if (minLeadScore !== null && (lead.leadScore === undefined || lead.leadScore === null || lead.leadScore < minLeadScore)) {
                return false;
            }

            // Estate category filter
            if (estateCategoryFilter !== 'all' && lead.listingType?.toLowerCase() !== estateCategoryFilter) {
                return false;
            }

            // City filter
            if (cityFilter !== 'all' && lead.city !== cityFilter) {
                return false;
            }

            // Caption/Notes search
            if (captionSearchTerm.trim()) {
                const searchTerm = captionSearchTerm.toLowerCase();
                const notes = (lead.notes || '').toLowerCase();
                if (!notes.includes(searchTerm)) return false;
            }

            return true;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'oldest':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case 'followers':
                    return (b.followerCount || 0) - (a.followerCount || 0);
                case 'name':
                    return (a.igUsername || '').localeCompare(b.igUsername || '');
                case 'score':
                    return (b.leadScore || 0) - (a.leadScore || 0);
                case 'engagement':
                    return (b.engagementRate || 0) - (a.engagementRate || 0);
                default:
                    return 0;
            }
        }), [
        leads,
        statusFilter,
        filterKeywords,
        leadsSearchQuery,
        followerRange,
        engagementRateRange,
        accountAgeRange,
        postFrequencyRange,
        minLeadScore,
        estateCategoryFilter,
        cityFilter,
        captionSearchTerm,
        sortBy
    ]);

    return {
        // Basic filters
        statusFilter, setStatusFilter,
        sortBy, setSortBy,
        leadsSearchQuery, setLeadsSearchQuery,

        // Advanced filters
        bioKeywords, setBioKeywords,
        followerRange, setFollowerRange,
        engagementRateRange, setEngagementRateRange,
        accountAgeRange, setAccountAgeRange,
        postFrequencyRange, setPostFrequencyRange,
        minLeadScore, setMinLeadScore,
        estateCategoryFilter, setEstateCategoryFilter,
        cityFilter, setCityFilter,
        captionSearchTerm, setCaptionSearchTerm,
        selectedPreset, setSelectedPreset,

        // Derived
        filterKeywords,
        uniqueCities,
        processedLeads,

        // Helper
        matchKeywordsInBio
    };
}
