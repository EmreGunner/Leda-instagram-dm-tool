import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Lead, InstagramAccount } from '@/lib/types/leads';

export function useLeadsData() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch leads
    const fetchLeads = useCallback(async (statusFilter: string = 'all') => {
        setIsLoading(true);
        try {
            const supabase = createClient();
            let query = supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            setLeads((data || []).map((l: any) => ({
                id: l.id,
                igUserId: l.ig_user_id || l.igUserId,
                igUsername: l.ig_username || l.igUsername,
                fullName: l.full_name || l.fullName,
                bio: l.bio,
                profilePicUrl: l.profile_pic_url || l.profilePicUrl,
                followerCount: l.follower_count || l.followerCount,
                followingCount: l.following_count || l.followingCount,
                postCount: l.post_count || l.postCount,
                isVerified: l.is_verified || l.isVerified,
                isPrivate: l.is_private || l.isPrivate,
                isBusiness: l.is_business || l.isBusiness,
                status: l.status,
                tags: l.tags || [],
                matchedKeywords: l.matched_keywords || l.matchedKeywords || [],
                source: l.source,
                sourceQuery: l.source_query || l.sourceQuery,
                createdAt: l.created_at || l.createdAt,
                // Enhanced fields
                leadScore: l.lead_score !== undefined ? l.lead_score : l.leadScore,
                engagementRate: l.engagement_rate || l.engagementRate,
                accountAge: l.account_age || l.accountAge,
                postFrequency: l.post_frequency || l.postFrequency,
                email: l.email,
                phone: l.phone,
                website: l.website,
                location: l.location,
                timesContacted: l.times_contacted || l.timesContacted || 0,
                lastContactedAt: l.last_contacted_at || l.lastContactedAt,
                lastInteractionAt: l.last_interaction_at || l.lastInteractionAt,
                // New fields for Turkish real estate
                listingType: l.listing_type || l.listingType,
                propertyType: l.property_type || l.propertyType,
                propertySubType: l.property_sub_type || l.propertySubType,
                city: l.city,
                town: l.town,
                commentCount: l.comment_count || l.commentCount,
                postLink: l.post_link || l.postLink,
                postCaption: l.post_caption || l.postCaption,
                commentDate: l.comment_date || l.commentDate,
                commentLink: l.comment_link || l.commentLink,
                notes: (l.source === 'comment-to-lead' && (l.post_caption || l.postCaption || l.source_post_caption)) ? (l.post_caption || l.postCaption || l.source_post_caption) : l.notes,
            })));
        } catch (error) {
            console.error('Error fetching leads:', error);
            toast.error('Failed to load leads');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Add leads from displayed results
    const handleAddLeads = async (
        users: any[],
        context: {
            selectedAccount: InstagramAccount | null,
            searchType: string,
            searchQuery: string
        }
    ) => {
        const { selectedAccount, searchType, searchQuery } = context;

        console.log('handleAddLeads called:', { selectedAccount, users: users.length, searchType });

        // NOTE: selectedAccount is optional - leads can be saved without linking to an account

        // NOTE: Cookies check moved to UI/Caller for simplicity or can be passed in. 
        // Assuming UI verified cookies exist via useInstagramAccounts.getCookies() if needed.
        // Actually, page.tsx checked cookies inside. We'll skip cookie check strictly here for now
        // because this function calls a backend api `api/leads/batch` which probably doesn't need frontend cookies?
        // Wait, page.tsx checks `getCookies()` before calling.
        // I'll assume caller handles cookie verification if needed, or I can pass cookies.
        // `api/leads/batch` likely needs workspace ID but not Instagram cookies unless it scrapes.
        // Looking at page.tsx, it checks cookies first.

        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
            toast.error('Authentication required', { description: 'Please log in to continue.' });
            return;
        }

        const { data: user } = await supabase
            .from('users')
            .select('workspace_id')
            .eq('supabase_auth_id', authUser.id)
            .single();

        if (!user?.workspace_id) {
            toast.error('Workspace not found', { description: 'Please refresh the page.' });
            return;
        }

        try {
            toast.loading(`Adding ${users.length} leads to database...`);

            const formatForApi = (u: any) => ({
                instagramAccountId: selectedAccount?.id || null, // Optional link to account
                pk: u.pk || u.id,
                username: u.username,
                fullName: u.fullName,
                bio: u.bio || u.biography,
                profilePicUrl: u.profilePicUrl,
                followerCount: u.followerCount || u.followersCount,
                followingCount: u.followingCount || u.followsCount,
                postCount: u.postCount || u.postsCount,
                isVerified: u.isVerified,
                isPrivate: u.isPrivate,
                isBusiness: u.isBusiness || u.isBusinessAccount,
                source: searchType,
                sourceQuery: searchQuery,
                matchedKeywords: u.matchedKeywords
            });

            const payload = users.map(formatForApi);
            const res = await fetch('/api/leads/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leads: payload,
                    workspaceId: user.workspace_id
                })
            });

            const data = await res.json();
            toast.dismiss();

            if (data.success) {
                toast.success(`Successfully added ${payload.length} leads!`);
                fetchLeads(); // Refresh leads
                return true; // Return success
            } else {
                toast.error('Failed to add leads', { description: data.error });
                return false;
            }
        } catch (error) {
            console.error('Error adding leads:', error);
            toast.dismiss();
            toast.error('Error adding leads');
            return false;
        }
    };

    // Delete leads
    const handleDeleteLeads = async (selectedLeadsIds: Set<string>, onSuccess: () => void) => {
        if (selectedLeadsIds.size === 0) return;
        if (!confirm(`Delete ${selectedLeadsIds.size} leads?`)) return;

        const supabase = createClient();
        const { error } = await supabase.from('leads').delete().in('id', Array.from(selectedLeadsIds));

        if (error) {
            toast.error('Failed to delete leads');
        } else {
            toast.success('Leads deleted');
            onSuccess(); // Clear selection
            fetchLeads();
        }
    };

    return {
        leads,
        isLoading,
        fetchLeads,
        handleAddLeads,
        handleDeleteLeads
    };
}
