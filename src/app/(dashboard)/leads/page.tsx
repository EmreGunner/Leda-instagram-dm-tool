'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Users,
  Hash,
  UserPlus,
  Filter,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Instagram,
  AlertCircle,
  Download,
  Trash2,
  Eye,
  Target,
  Plus,
  List,
  Clock,
  MessageSquare,
  X
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { usePostHog } from '@/hooks/use-posthog';
import { toast } from 'sonner';
import { MobileLeadCard } from "@/components/leads/mobile-lead-card";
import { LeadProfileModal } from '@/components/leads/lead-profile-modal';
import { getRandomDelay, formatDelayTime } from '@/lib/utils/rate-limit';
import { getCookies as getCookiesFromStorage } from '@/lib/instagram-cookie-storage';

// Use relative URLs since we're on the same domain (Next.js API routes)
// All API calls use relative URLs since backend and frontend are on the same domain

interface Lead {
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

interface InstagramAccount {
  id: string;
  igUserId: string;
  igUsername: string;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'New' },
  contacted: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Contacted' },
  replied: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Replied' },
  converted: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Converted' },
  unsubscribed: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Unsubscribed' },
};

// Preset keyword categories for different target audiences
const KEYWORD_PRESETS = [
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

export default function LeadsPage() {
  const { capture } = usePostHog();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InstagramAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  // Search state
  const [searchType, setSearchType] = useState<'username' | 'hashtag' | 'followers' | 'comment-to-lead'>('username');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLimit, setSearchLimit] = useState(50);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null); // For followers search

  // Comment-to-Lead configuration state (Card-based)
  const [ctlActiveCard, setCtlActiveCard] = useState<1 | 2 | 3 | null>(null);
  const [ctlTargetAccounts, setCtlTargetAccounts] = useState<any[]>([]);
  const [ctlUsernameInput, setCtlUsernameInput] = useState('');
  const [ctlIsAddingAccount, setCtlIsAddingAccount] = useState(false);

  const [ctlTargetPosts, setCtlTargetPosts] = useState<any[]>([]);
  const [ctlSelectedPostIds, setCtlSelectedPostIds] = useState<Set<string>>(new Set());
  const [ctlIsFetchingPosts, setCtlIsFetchingPosts] = useState(false);

  // Post paste support
  const [ctlPastedPostLinks, setCtlPastedPostLinks] = useState('');
  const [ctlIsParsingPosts, setCtlIsParsingPosts] = useState(false);
  const [ctlExpandedCaptions, setCtlExpandedCaptions] = useState<Set<string>>(new Set());

  // Comment extraction filters
  const [commentLocation, setCommentLocation] = useState('');
  const [commentListingKeywords, setCommentListingKeywords] = useState('satılık, kiralık, daire, konut');
  const [commentIntentKeywords, setCommentIntentKeywords] = useState('fiyat, fiat, ne kadar, kaç tl');
  const [commentDateFrom, setCommentDateFrom] = useState('');
  const [commentDateTo, setCommentDateTo] = useState('');
  const [ctlScrapingStatus, setCtlScrapingStatus] = useState('');

  // Hashtag search now defaults to bio only (posts option removed)

  // Followers/Following search state
  const [targetUserProfile, setTargetUserProfile] = useState<any>(null);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [isLoadingTargetUser, setIsLoadingTargetUser] = useState(false);

  // Filter state
  const [bioKeywords, setBioKeywords] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customKeyword, setCustomKeyword] = useState('');
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [followerRange, setFollowerRange] = useState<[number, number] | null>(null);
  const [engagementRateRange, setEngagementRateRange] = useState<[number, number] | null>(null);
  const [accountAgeRange, setAccountAgeRange] = useState<[number, number] | null>(null);
  const [postFrequencyRange, setPostFrequencyRange] = useState<[number, number] | null>(null);
  const [minLeadScore, setMinLeadScore] = useState<number | null>(null);
  const [estateCategoryFilter, setEstateCategoryFilter] = useState<'all' | 'sale' | 'rent'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [captionSearchTerm, setCaptionSearchTerm] = useState('');

  // Bulk actions
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'tags' | null>(null);
  const [bulkActionValue, setBulkActionValue] = useState('');
  const [isPerformingBulkAction, setIsPerformingBulkAction] = useState(false);

  // Lead Lists
  const [leadLists, setLeadLists] = useState<any[]>([]);
  const [showLeadListsModal, setShowLeadListsModal] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isLoadingLists, setIsLoadingLists] = useState(false);

  // Leads list state
  const [leadsSearchQuery, setLeadsSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'followers' | 'name' | 'score' | 'engagement'>('newest');
  const [displayedLeadsCount, setDisplayedLeadsCount] = useState(50); // Start with 50 leads
  const leadsPerBatch = 50; // Load 50 more at a time

  // Modals
  const [showBulkDmModal, setShowBulkDmModal] = useState(false);
  const [bulkDmMessage, setBulkDmMessage] = useState('');
  const [isSendingBulkDm, setIsSendingBulkDm] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Batch loading states
  const [displayedSearchResults, setDisplayedSearchResults] = useState<any[]>([]);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [batchSize] = useState(10); // Load 10 initially
  const [moreBatchSize] = useState(5); // Load 5 more on button click

  // Profile modal state
  const [showLeadProfileModal, setShowLeadProfileModal] = useState(false);
  const [profileModalUsername, setProfileModalUsername] = useState('');

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('instagram_accounts')
        .select('id, ig_user_id, ig_username')
        .eq('is_active', true);

      if (data) {
        const accs = data.map((a: any) => ({
          id: a.id,
          igUserId: a.ig_user_id,
          igUsername: a.ig_username,
        }));
        setAccounts(accs);
        if (accs.length > 0 && !selectedAccount) {
          setSelectedAccount(accs[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [selectedAccount]);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
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
        // Leads 2.0
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
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAccounts();
    fetchLeads();
  }, [fetchAccounts, fetchLeads]);

  // Get cookies using centralized utility with fallback mechanisms
  const getCookies = () => {
    if (!selectedAccount) {
      console.log('getCookies: No selected account');
      return null;
    }

    const cookies = getCookiesFromStorage({
      igUserId: selectedAccount.igUserId,
      igUsername: selectedAccount.igUsername,
    });

    if (!cookies) {
      console.log('getCookies: No cookies found for account:', selectedAccount.igUsername);
    }

    return cookies;
  };

  // Wizard Step 1: Add Target
  const handleAddTarget = async () => {
    if (!ctlUsernameInput.trim() || !selectedAccount) return;

    setCtlIsAddingAccount(true);
    const cookies = getCookies();

    if (!cookies) {
      toast.error('Session expired');
      setCtlIsAddingAccount(false);
      return;
    }

    try {
      const res = await fetch(`/api/instagram/cookie/user/${ctlUsernameInput.replace('@', '')}/profile`, {
        method: 'POST',
        body: JSON.stringify({ cookies })
      });
      const data = await res.json();

      if (data.success && data.profile) {
        if (ctlTargetAccounts.some(a => a.pk === data.profile.pk)) {
          toast.warning('Account already added');
        } else {
          setCtlTargetAccounts([...ctlTargetAccounts, data.profile]);
          setCtlUsernameInput('');
          toast.success('Target account added');
        }
      } else {
        toast.error('User not found');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to add user');
    } finally {
      setCtlIsAddingAccount(false);
    }
  };

  // Wizard Step 2: Fetch Posts
  const handleFetchPosts = async () => {
    if (ctlTargetAccounts.length === 0 || !selectedAccount) return;

    setCtlIsFetchingPosts(true);
    const cookies = getCookies();
    let allMedia: any[] = [];

    try {
      for (const account of ctlTargetAccounts) {
        const res = await fetch('/api/instagram/cookie/users/posts', {
          method: 'POST',
          body: JSON.stringify({ cookies, username: account.username, limit: 12 })
        });
        const data = await res.json();
        if (data.success) {
          // Attach user info to media for display
          const mediaWithUser = data.media.map((m: any) => ({ ...m, user: account }));
          allMedia = [...allMedia, ...mediaWithUser];
        }
      }
      console.log('Fetched posts:', allMedia);
      console.log('Sample post:', allMedia[0]);
      setCtlTargetPosts(allMedia);
      toast.success(`Fetched ${allMedia.length} posts`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to fetch posts');
    } finally {
      setCtlIsFetchingPosts(false);
    }
  };

  // Wizard Step 3: Scrape
  const handleScrapeComments = async () => {
    if (ctlSelectedPostIds.size === 0 || !selectedAccount) return;

    setCtlScrapingStatus('Starting scrape...');
    setIsSearching(true);
    const cookies = getCookies();

    const selectedMedia = ctlTargetPosts.filter(p => ctlSelectedPostIds.has(p.id));

    console.log('[Frontend] Sending posts for comment extraction:', selectedMedia.map(p => ({
      id: p.id,
      code: p.code || p.shortcode,
      hasCaption: !!p.caption
    })));

    try {
      const res = await fetch('/api/leads/comment-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookies,
          mediaIds: selectedMedia.map(post => ({
            id: post.id,
            code: post.code || post.shortcode, // Normalize code field
            caption: post.caption
          })),
          intentKeywords: commentIntentKeywords.split(',').map(k => k.trim()).filter(Boolean)
        })
      });
      const data = await res.json();

      if (data.success) {
        const newLeads = data.users.filter((u: any) => u.isNew);
        const savedMsg = newLeads.length > 0
          ? `Found ${data.users.length} leads. Saved ${newLeads.length} new: ${newLeads.map((u: any) => '@' + u.username).join(', ')}`
          : `Found ${data.users.length} leads (all existing).`;

        toast.success(savedMsg);
        setCtlScrapingStatus(`Completed! ${savedMsg}`);
        fetchLeads(); // Refresh leads table
      } else {
        setCtlScrapingStatus('Failed: ' + data.error);
        toast.error(data.error || 'Scraping failed');
      }
    } catch (e) {
      setCtlScrapingStatus('Error occurred');
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // State for search errors
  const [searchError, setSearchError] = useState<string | null>(null);

  // Search users
  const handleSearch = async (loadMore = false, overrideQuery?: string, overrideType?: 'username' | 'hashtag' | 'followers') => {
    const query = overrideQuery || searchQuery;
    const type = overrideType || searchType;

    setSearchError(null);
    console.log('handleSearch called:', { query, type, selectedAccount, loadMore });

    if (!query.trim()) {
      setSearchError('Please enter a search query');
      return;
    }

    if (!selectedAccount) {
      setSearchError('Please select an Instagram account first');
      return;
    }

    const cookies = getCookies();
    console.log('Cookies found:', !!cookies);

    if (!cookies) {
      setSearchError('No session found. Please reconnect your Instagram account from Settings > Instagram Accounts. Use the Chrome extension to grab your session.');
      return;
    }

    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setSearchResults([]);
      setSearchLimit(50);
      setTargetUserId(null);
    }

    const currentLimit = loadMore ? searchLimit + 50 : 50;

    try {
      let endpoint = '';
      let body: any = { cookies };
      let userId = targetUserId;

      switch (type) {
        case 'username':
          endpoint = '/api/instagram/cookie/users/search';
          body.query = query;
          body.limit = Math.min(currentLimit, 50); // Username search limited to 50
          break;
        case 'hashtag':
          endpoint = `/api/instagram/cookie/hashtag/${query.replace('#', '')}/users`;
          body.limit = currentLimit;
          body.searchSource = 'bio'; // Always use bio search for hashtags
          // Include bio keywords for filtering
          let keywords: string[] = [];
          if (selectedPreset) {
            const preset = KEYWORD_PRESETS.find(p => p.name === selectedPreset);
            keywords = preset?.keywords || [];
          }
          const customKeywords = bioKeywords.split(',').map(k => k.trim()).filter(k => k);
          body.bioKeywords = [...keywords, ...customKeywords];
          break;
        case 'followers':
          // Use cached user ID from lookup
          if (!userId) {
            toast.warning('User lookup required', {
              description: 'Please lookup the user first to get their profile information.',
            });
            setIsSearching(false);
            setIsLoadingMore(false);
            return;
          }
          // Use followListType to decide followers or following
          endpoint = `/api/instagram/cookie/user/by-id/${userId}/${followListType}`;
          body.limit = currentLimit;
          break;
        case 'comment-to-lead':
          // This flow now uses dedicated card-based handlers
          toast.info('Please use the cards below to configure extraction');
          setIsSearching(false);
          return;
      }

      console.log('Making request to:', endpoint, body);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Search result:', result);

      if (result.success) {
        const results = result.users || result.followers || result.following || [];

        if (!loadMore) {
          // Reset batch loading state on new search
          setSearchResults(results);
          setDisplayedSearchResults([]);
          setCurrentBatchIndex(0);

          // Automatically trigger loading first batch if we have results
          if (results.length > 0) {
            setTimeout(() => {
              loadNextBatch(batchSize);
            }, 500);
          }
        } else {
          // For load more, just add to search results
          setSearchResults(results);
        }

        setSearchLimit(currentLimit);
        setSearchError(''); // Clear any previous errors

        // Track lead search
        capture('lead_search_performed', {
          search_type: type,
          query: query,
          results_count: results.length,
          has_preset: !!selectedPreset,
          has_custom_keywords: !!bioKeywords,
        });

        if (results.length === 0) {
          // Provide more helpful error messages based on search type
          if (type === 'hashtag') {
            setSearchError(
              `No users found for "${query}". Try:\n` +
              `• Using a more popular or specific keyword\n` +
              `• Checking if the hashtag exists on Instagram\n` +
              `• Trying a related keyword (e.g., "business coach" instead of "businesscoach")\n` +
              `• Using a different search method (try username search)`
            );
          } else if (type === 'username') {
            setSearchError(`No users found matching "${query}". Try a different search term.`);
          } else {
            setSearchError('No users found. Try a different keyword or check your Instagram session.');
          }
        }

        // Check if there might be more results
        // For followers/hashtag, if we got the full limit, there might be more
        if (type !== 'username' && results.length >= currentLimit) {
          setHasMoreResults(true);
        } else {
          setHasMoreResults(false);
        }
      } else {
        console.error('Search failed:', result.error);
        const errorMsg = result.error || 'Search failed. Please check your Instagram session.';
        setSearchError(errorMsg);
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMsg = (error as Error).message;
      setSearchError(`Search failed: ${errorMsg}`);
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  };

  // Lookup user for followers/following search
  const handleLookupUser = async () => {
    if (!searchQuery.trim() || !selectedAccount) return;

    const cookies = getCookies();
    if (!cookies) {
      toast.error('Session expired', {
        description: 'Please reconnect your Instagram account.',
      });
      return;
    }

    setIsLoadingTargetUser(true);
    setTargetUserProfile(null);
    setSearchResults([]);

    try {
      const userRes = await fetch(`/api/instagram/cookie/user/${searchQuery.replace('@', '')}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies }),
      });
      const userData = await userRes.json();

      if (!userData.success || !userData.profile) {
        toast.error('User not found', {
          description: 'Please check the username and try again.',
        });
        return;
      }

      const profile = userData.profile;
      setTargetUserProfile({
        pk: profile.pk,
        username: profile.username,
        fullName: profile.fullName,
        bio: profile.biography || profile.bio,
        profilePicUrl: profile.profilePicUrl,
        isVerified: profile.isVerified,
        isPrivate: profile.isPrivate,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        mediaCount: profile.mediaCount,
        // Friendship status
        followedByViewer: profile.followedByViewer,
        followsViewer: profile.followsViewer,
      });
      setTargetUserId(profile.pk);
    } catch (error) {
      console.error('Lookup error:', error);
      toast.error('Lookup failed', {
        description: 'Failed to lookup user. Please try again.',
      });
    } finally {
      setIsLoadingTargetUser(false);
    }
  };

  // Load batch of search results with random delays
  const loadNextBatch = async (count: number) => {
    if (!selectedAccount || searchResults.length === 0) return;

    const cookies = getCookies();
    if (!cookies) {
      toast.error('Session expired', {
        description: 'Please reconnect your Instagram account.',
      });
      return;
    }

    // Get keywords from preset or custom input
    let keywords: string[] = [];
    if (selectedPreset) {
      const preset = KEYWORD_PRESETS.find(p => p.name === selectedPreset);
      keywords = preset?.keywords || [];
    }
    const customKeywords = bioKeywords.split(',').map(k => k.trim()).filter(k => k);
    keywords = [...keywords, ...customKeywords];

    setIsLoadingBatch(true);
    const startIndex = currentBatchIndex;
    const endIndex = Math.min(startIndex + count, searchResults.length);
    const batch = searchResults.slice(startIndex, endIndex);

    setLoadingProgress({ current: 0, total: batch.length });

    const newDisplayedResults: any[] = [];

    for (let i = 0; i < batch.length; i++) {
      const userProfile = batch[i];

      try {
        setLoadingProgress({ current: i + 1, total: batch.length });

        // Fetch full profile with bio
        const profileRes = await fetch(`/api/instagram/cookie/user/${userProfile.username}/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies }),
        });
        const profileData = await profileRes.json();

        const profile = profileData.success ? profileData.profile : userProfile;
        const bio = profile.bio || '';

        // Use smart keyword matching
        const matchedKeywords = matchKeywordsInBio(bio, keywords);

        // Add to displayed results with full profile data
        newDisplayedResults.push({
          ...profile,
          username: profile.username || userProfile.username,
          fullName: profile.fullName || userProfile.fullName,
          bio: profile.bio,
          matchedKeywords,
          source: userProfile.source,
          matchedKeyword: userProfile.matchedKeyword,
        });

        // Update displayed results immediately (incremental display)
        setDisplayedSearchResults(prev => [...prev, {
          ...profile,
          username: profile.username || userProfile.username,
          fullName: profile.fullName || userProfile.fullName,
          bio: profile.bio,
          matchedKeywords,
          source: userProfile.source,
          matchedKeyword: userProfile.matchedKeyword,
        }]);

        // Random delay between 5-15 seconds (except for the last item)
        if (i < batch.length - 1) {
          const delay = getRandomDelay();
          console.log(`Waiting ${formatDelayTime(delay)} before next profile...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Failed to load profile ${userProfile.username}:`, error);
      }
    }

    setCurrentBatchIndex(endIndex);
    setIsLoadingBatch(false);
    setLoadingProgress({ current: 0, total: 0 });

    if (endIndex >= searchResults.length) {
      toast.success('All profiles loaded!', {
        description: `Loaded ${displayedSearchResults.length + newDisplayedResults.length} profiles`,
      });
    }
  };

  // Add leads from displayed results
  const handleAddLeads = async (users: any[]) => {
    if (!selectedAccount) return;

    const cookies = getCookies();
    if (!cookies) {
      toast.error('Session expired', {
        description: 'Please reconnect your Instagram account.',
      });
      return;
    }

    // Get keywords from preset or custom input
    let keywords: string[] = [];
    if (selectedPreset) {
      const preset = KEYWORD_PRESETS.find(p => p.name === selectedPreset);
      keywords = preset?.keywords || [];
    }
    // Add custom keywords
    const customKeywords = bioKeywords.split(',').map(k => k.trim()).filter(k => k);
    keywords = [...keywords, ...customKeywords];

    const supabase = createClient();
    // Get current user's workspace
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      toast.error('Authentication required', {
        description: 'Please log in to continue.',
      });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('supabase_auth_id', authUser.id)
      .single();

    if (!user?.workspace_id) {
      toast.error('Workspace not found', {
        description: 'Please refresh the page and try again.',
      });
      return;
    }

    const workspaceId = user.workspace_id;

    let addedCount = 0;

    // Show progress
    toast.info('Adding leads', {
      description: `Adding ${users.length} leads to database...`,
      duration: 3000,
    });

    for (const profile of users) {
      try {
        // Insert into database (RLS will verify workspace_id)
        const leadId = crypto.randomUUID();
        const leadNow = new Date().toISOString();
        await supabase.from('leads').upsert({
          id: leadId,
          workspace_id: workspaceId,
          instagram_account_id: selectedAccount.id,
          ig_user_id: profile.pk,
          ig_username: profile.username,
          full_name: profile.fullName,
          bio: profile.bio,
          profile_pic_url: profile.profilePicUrl,
          follower_count: profile.followerCount,
          following_count: profile.followingCount,
          post_count: profile.postCount,
          is_verified: profile.isVerified || false,
          is_private: profile.isPrivate || false,
          is_business: profile.isBusiness || false,
          status: 'new',
          source: searchType,
          source_query: searchQuery,
          matched_keywords: profile.matchedKeywords || [],
          updated_at: leadNow,
        }, {
          onConflict: 'ig_user_id,workspace_id'
        });

        addedCount++;
      } catch (error) {
        console.error(`Failed to add lead ${profile.username}:`, error);
      }
    }

    toast.success('Leads added!', {
      description: `Successfully added ${addedCount} leads to your database`,
      duration: 5000,
    });
    setDisplayedSearchResults([]);
    setSearchResults([]);
    setCurrentBatchIndex(0);
    fetchLeads();
  };

  // View profile
  const handleViewProfile = async (lead: Lead) => {
    setShowProfileModal(true);
    setIsLoadingProfile(true);

    // Always fetch full lead data including history and enrichment
    const supabase = createClient();
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead.id)
      .single();

    // Set initial profile with history data
    setSelectedProfile({
      ...lead,
      // Include history and enrichment data
      leadScore: leadData?.lead_score,
      engagementRate: leadData?.engagement_rate,
      accountAge: leadData?.account_age,
      postFrequency: leadData?.post_frequency,
      email: leadData?.email,
      phone: leadData?.phone,
      website: leadData?.website,
      location: leadData?.location,
      timesContacted: leadData?.times_contacted || 0,
      lastContactedAt: leadData?.last_contacted_at,
      lastInteractionAt: leadData?.last_interaction_at,
      dmSentAt: leadData?.dm_sent_at,
      dmRepliedAt: leadData?.dm_replied_at,
    });

    // Fetch fresh profile data from Instagram if account is connected
    if (selectedAccount) {
      const cookies = getCookies();
      if (cookies) {
        try {
          const res = await fetch(`/api/instagram/cookie/user/${lead.igUsername}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies }),
          });
          const data = await res.json();
          if (data.success) {
            setSelectedProfile((prev: any) => ({
              ...prev,
              ...data.profile,
            }));

            // Update in database
            await supabase.from('leads').update({
              bio: data.profile.bio,
              follower_count: data.profile.followerCount,
              following_count: data.profile.followingCount,
              post_count: data.profile.postCount,
            }).eq('id', lead.id);
          }
        } catch (e) {
          console.error('Failed to fetch profile:', e);
        }
      }
    }
    setIsLoadingProfile(false);
  };

  // Send bulk DM
  const handleSendBulkDm = async () => {
    if (!selectedAccount || selectedLeads.size === 0 || !bulkDmMessage.trim()) return;

    const cookies = getCookies();
    if (!cookies) {
      toast.error('Session expired', {
        description: 'Please reconnect your Instagram account.',
      });
      return;
    }

    setIsSendingBulkDm(true);

    const leadsToMessage = leads.filter(l => selectedLeads.has(l.id));
    let sentCount = 0;
    let failedCount = 0;

    for (const lead of leadsToMessage) {
      try {
        const response = await fetch('/api/instagram/cookie/dm/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cookies,
            recipientUsername: lead.igUsername,
            message: bulkDmMessage.replace('{{name}}', lead.fullName || lead.igUsername),
          }),
        });

        const result = await response.json();

        if (result.success) {
          sentCount++;
          // Update lead status
          const supabase = createClient();
          await supabase.from('leads').update({
            status: 'contacted',
            dm_sent_at: new Date().toISOString(),
          }).eq('id', lead.id);
        } else {
          failedCount++;
        }

        // Delay between messages
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        failedCount++;
      }
    }

    toast.success('Bulk DM sent!', {
      description: `Sent ${sentCount} DMs${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
    });
    setShowBulkDmModal(false);
    setBulkDmMessage('');
    setSelectedLeads(new Set());
    fetchLeads();
    setIsSendingBulkDm(false);
  };

  // Delete leads
  const handleDeleteLeads = async () => {
    if (selectedLeads.size === 0) return;
    if (!confirm(`Delete ${selectedLeads.size} leads?`)) return;

    const supabase = createClient();
    await supabase.from('leads').delete().in('id', Array.from(selectedLeads));
    setSelectedLeads(new Set());
    fetchLeads();
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (selectedLeads.size === 0 || !bulkActionType) return;

    setIsPerformingBulkAction(true);
    try {
      const response = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: bulkActionType === 'status' ? 'updateStatus' : 'addTags',
          leadIds: Array.from(selectedLeads),
          data: bulkActionType === 'status'
            ? { status: bulkActionValue }
            : { tags: bulkActionValue.split(',').map(t => t.trim()).filter(Boolean) },
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Bulk action completed', {
          description: `Updated ${result.updated} leads.`,
        });
        setShowBulkActionsModal(false);
        setBulkActionType(null);
        setBulkActionValue('');
        setSelectedLeads(new Set());
        fetchLeads();
      } else {
        toast.error('Bulk action failed', {
          description: result.error || 'Unknown error occurred.',
        });
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Bulk action failed', {
        description: 'Please try again later.',
      });
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  // Export leads to CSV
  const handleExportLeads = async () => {
    const leadIds = selectedLeads.size > 0 ? Array.from(selectedLeads) : undefined;

    try {
      const response = await fetch('/api/leads/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Export successful', {
        description: 'Leads exported to CSV file.',
      });
    } catch (error) {
      console.error('Error exporting leads:', error);
      toast.error('Export failed', {
        description: 'Failed to export leads. Please try again.',
      });
    }
  };

  // Fetch lead lists
  const fetchLeadLists = useCallback(async () => {
    setIsLoadingLists(true);
    try {
      const response = await fetch('/api/leads/lists');
      const result = await response.json();
      if (result.success) {
        setLeadLists(result.lists || []);
      }
    } catch (error) {
      console.error('Error fetching lead lists:', error);
    } finally {
      setIsLoadingLists(false);
    }
  }, []);

  // Create lead list
  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.warning('List name required', {
        description: 'Please enter a name for the list.',
      });
      return;
    }

    try {
      const response = await fetch('/api/leads/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName,
          description: newListDescription,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setNewListName('');
        setNewListDescription('');
        setShowCreateListModal(false);
        fetchLeadLists();
        toast.success('List created!', {
          description: 'Lead list created successfully.',
        });
      } else {
        toast.error('Failed to create list', {
          description: result.error || 'Unknown error occurred.',
        });
      }
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error('Failed to create list', {
        description: 'Please try again later.',
      });
    }
  };

  // Add selected leads to list
  const handleAddToList = async (listId: string) => {
    if (selectedLeads.size === 0) {
      toast.warning('No leads selected', {
        description: 'Please select leads to add to the list.',
      });
      return;
    }

    try {
      const response = await fetch(`/api/leads/lists/${listId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: Array.from(selectedLeads),
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Added ${result.added} leads to list`);
        setShowLeadListsModal(false);
        setSelectedLeads(new Set());
      } else {
        alert('Failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding leads to list:', error);
      alert('Failed to add leads to list');
    }
  };

  // Load lead lists on mount
  useEffect(() => {
    fetchLeadLists();
  }, [fetchLeadLists]);

  // Toggle lead selection
  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  // Select all
  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  // Get unique cities for filter
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    leads.forEach(l => {
      if (l.city) cities.add(l.city);
    });
    return Array.from(cities).sort();
  }, [leads]);

  // Filter, search, and sort leads
  const processedLeads = leads
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
    });

  // Display leads (limited by displayedLeadsCount)
  const displayedLeads = processedLeads.slice(0, displayedLeadsCount);
  const hasMoreLeads = processedLeads.length > displayedLeadsCount;

  // Load more leads
  const handleLoadMore = () => {
    setDisplayedLeadsCount(prev => prev + leadsPerBatch);
  };

  // Reset displayed leads count when filters change
  useEffect(() => {
    setDisplayedLeadsCount(50); // Reset to initial batch size
  }, [statusFilter, leadsSearchQuery, sortBy, filterKeywords]);

  return (
    <div className="min-h-screen">
      <Header
        title="Lead Generation"
        subtitle="Find and target potential customers on Instagram"
      />

      <div className="p-4 md:p-6">
        {/* No Accounts Warning */}
        {accounts.length === 0 && !isLoading && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-400 font-medium">
                Connect an Instagram account first
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (window.location.href = "/settings/instagram")}
              className="w-full sm:w-auto">
              <Instagram className="h-4 w-4" />
              Connect
            </Button>
          </div>
        )}

        {/* Search Section */}
        <div className="bg-background-secondary rounded-xl border border-border p-4 md:p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Find Leads
          </h3>

          {/* Account Selector */}
          {accounts.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground-muted mb-2">
                Using Account
              </label>
              <select
                value={selectedAccount?.id || ""}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  if (acc) setSelectedAccount(acc);
                }}
                className="w-full max-w-xs px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.igUsername}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Type Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              {
                type: "username",
                icon: Search,
                label: "Search Target Audience",
              },
              { type: "hashtag", icon: Hash, label: "Hashtag" },
              { type: "followers", icon: Users, label: "User's Followers" },
              { type: "comment-to-lead", icon: MessageSquare, label: "Real Estate Comment To Lead Generation" },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setSearchType(type as any)}
                className={cn(
                  "flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors",
                  searchType === type
                    ? "bg-accent text-white"
                    : "bg-background-elevated text-foreground-muted hover:text-foreground"
                )}>
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          {/* Search Input & Wizard */}
          {searchType === 'comment-to-lead' ? (
            <div className="space-y-6 mb-4">
              {/* Header */}
              <div className="bg-background-elevated rounded-xl p-4 border border-border">
                <h3 className="text-lg font-semibold text-foreground mb-2">Lead Extraction</h3>
                <p className="text-sm text-foreground-muted">Start from any card below. Paste links directly or fetch from accounts.</p>
              </div>

              {/* Three Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* CARD 1: Account Management */}
                <div className={cn(
                  "bg-background-elevated rounded-xl border-2 p-6 transition-all",
                  ctlActiveCard === 1 ? "border-accent shadow-lg shadow-accent/20" : "border-border"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-foreground">1. Target Accounts</h4>
                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                  </div>
                  <p className="text-xs text-foreground-muted mb-4">Add accounts to fetch their posts, or skip to Card 2</p>

                  {/* Account Input */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="@username"
                        value={ctlUsernameInput}
                        onChange={(e) => {
                          setCtlUsernameInput(e.target.value);
                          setCtlActiveCard(1);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTarget()}
                        className="bg-background text-foreground border-border"
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={handleAddTarget}
                        disabled={ctlIsAddingAccount || !ctlUsernameInput.trim()}
                      >
                        {ctlIsAddingAccount ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>

                    {/* Added Accounts */}
                    {ctlTargetAccounts.length > 0 && (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {ctlTargetAccounts.map((acc) => (
                          <div key={acc.pk} className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
                            <Avatar src={acc.profilePicUrl} name={acc.username} className="h-8 w-8" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">@{acc.username}</p>
                              <p className="text-xs text-foreground-muted">{acc.followerCount?.toLocaleString() || 0} followers</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => setCtlTargetAccounts(prev => prev.filter(a => a.pk !== acc.pk))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fetch Posts Button */}
                    {ctlTargetAccounts.length > 0 && (
                      <Button
                        onClick={handleFetchPosts}
                        disabled={ctlIsFetchingPosts}
                        className="w-full bg-accent hover:bg-accent/90 text-white"
                        size="sm"
                      >
                        {ctlIsFetchingPosts ? (
                          <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Fetching...</>
                        ) : (
                          <>Fetch Posts from {ctlTargetAccounts.length} Account{ctlTargetAccounts.length > 1 ? 's' : ''}</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* CARD 2: Post Selection */}
                <div className={cn(
                  "bg-background-elevated rounded-xl border-2 p-6 transition-all",
                  ctlActiveCard === 2 ? "border-accent shadow-lg shadow-accent/20" : "border-border"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-foreground">2. Select Posts</h4>
                    {ctlSelectedPostIds.size > 0 && (
                      <Badge className="bg-accent text-white">{ctlSelectedPostIds.size} selected</Badge>
                    )}
                  </div>
                  <p className="text-xs text-foreground-muted mb-4">Paste links or select from fetched posts</p>

                  {/* Post Paste Textarea */}
                  <div className="space-y-3">
                    <textarea
                      placeholder="Paste Instagram post URLs (one per line)..."
                      value={ctlPastedPostLinks}
                      onChange={(e) => {
                        setCtlPastedPostLinks(e.target.value);
                        setCtlActiveCard(2);
                      }}
                      rows={3}
                      className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    {ctlPastedPostLinks.trim() && (
                      <Button
                        onClick={async () => {
                          setCtlIsParsingPosts(true);

                          try {
                            // Extract shortcodes from pasted text
                            const lines = ctlPastedPostLinks.split('\n').filter(l => l.trim());
                            const shortcodes: string[] = [];

                            for (const line of lines) {
                              // Support multiple formats:
                              // https://www.instagram.com/p/SHORTCODE/
                              // instagram.com/p/SHORTCODE
                              // SHORTCODE (raw)
                              const match = line.match(/(?:instagram\.com\/p\/|\/p\/)([A-Za-z0-9_-]+)/);
                              if (match) {
                                shortcodes.push(match[1]);
                              } else if (line.trim().match(/^[A-Za-z0-9_-]+$/)) {
                                // Raw shortcode
                                shortcodes.push(line.trim());
                              }
                            }

                            if (shortcodes.length === 0) {
                              toast.error('No valid Instagram post URLs found');
                              setCtlIsParsingPosts(false);
                              return;
                            }

                            console.log('[Manual Post] Parsing shortcodes:', shortcodes);
                            toast.info(`Fetching ${shortcodes.length} post(s)...`);

                            const cookies = getCookies();
                            if (!cookies) {
                              toast.error('No Instagram account connected');
                              setCtlIsParsingPosts(false);
                              return;
                            }

                            // Fetch each post
                            const fetchedPosts: any[] = [];
                            for (const shortcode of shortcodes) {
                              try {
                                const res = await fetch(`/api/instagram/cookie/post/${shortcode}`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ cookies })
                                });

                                const data = await res.json();
                                if (data.success && data.post) {
                                  fetchedPosts.push(data.post);
                                } else {
                                  console.error('Failed to fetch post:', shortcode, data.error);
                                  toast.error(`Failed to fetch ${shortcode}: ${data.error}`);
                                }
                              } catch (error) {
                                console.error('Error fetching post:', shortcode, error);
                              }
                            }

                            if (fetchedPosts.length > 0) {
                              // Merge with existing posts (avoid duplicates by ID)
                              const existingIds = new Set(ctlTargetPosts.map(p => p.id));
                              const newPosts = fetchedPosts.filter(p => !existingIds.has(p.id));

                              setCtlTargetPosts([...ctlTargetPosts, ...newPosts]);
                              toast.success(`Added ${newPosts.length} post(s)`);
                              setCtlPastedPostLinks(''); // Clear textarea
                            } else {
                              toast.error('Failed to fetch any posts');
                            }

                          } catch (error: any) {
                            console.error('Post parsing error:', error);
                            toast.error('Error parsing posts: ' + error.message);
                          } finally {
                            setCtlIsParsingPosts(false);
                          }
                        }}
                        disabled={ctlIsParsingPosts}
                        size="sm"
                        className="w-full"
                      >
                        {ctlIsParsingPosts ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : 'Parse Posts'}
                      </Button>
                    )}

                    {/* Fetched Posts Grid */}
                    {ctlTargetPosts.length > 0 && (
                      <>
                        <div className="border-t border-border pt-3 mt-3">
                          <p className="text-xs text-foreground-muted mb-2">{ctlTargetPosts.length} posts fetched</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                          {ctlTargetPosts.map((post) => {
                            const isSelected = ctlSelectedPostIds.has(post.id);
                            const isExpanded = ctlExpandedCaptions.has(post.id);
                            const caption = post.caption?.text || post.caption || '';
                            const truncatedCaption = caption.length > 60 ? caption.substring(0, 60) + '...' : caption;
                            // Try multiple image URL fields
                            const imageUrl = post.thumbnailUrl || post.displayUrl || post.thumbnail_url || post.image_versions2?.candidates?.[0]?.url || '';

                            return (
                              <div
                                key={post.id}
                                className={cn(
                                  "cursor-pointer relative group rounded-lg overflow-hidden border-2 transition-all",
                                  isSelected ? "border-accent ring-2 ring-accent/50" : "border-border hover:border-accent/50"
                                )}
                                onClick={() => {
                                  const newSet = new Set(ctlSelectedPostIds);
                                  if (newSet.has(post.id)) newSet.delete(post.id);
                                  else newSet.add(post.id);
                                  setCtlSelectedPostIds(newSet);
                                  setCtlActiveCard(2);
                                }}
                              >
                                {/* Post Image */}
                                <div className="aspect-square relative">
                                  {(() => {
                                    // API now returns thumbnailUrl directly in camelCase
                                    const imageUrl = post.thumbnailUrl || '';

                                    return imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        alt="Post"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          console.error('Image load error for post:', post.id, imageUrl);
                                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50%"  y="50%" fill="%23999" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-background-elevated flex items-center justify-center text-foreground-muted text-xs">
                                        No preview
                                      </div>
                                    );
                                  })()}
                                  {/* Selection Overlay */}
                                  <div className={cn(
                                    "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity",
                                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                  )}>
                                    {isSelected ? (
                                      <CheckCircle2 className="text-accent h-8 w-8" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border-2 border-white" />
                                    )}
                                  </div>
                                </div>

                                {/* Caption */}
                                <div className="p-2 bg-background">
                                  <p className="text-xs text-foreground leading-tight">
                                    {isExpanded ? caption : truncatedCaption}
                                  </p>
                                  {caption.length > 60 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newSet = new Set(ctlExpandedCaptions);
                                        if (newSet.has(post.id)) newSet.delete(post.id);
                                        else newSet.add(post.id);
                                        setCtlExpandedCaptions(newSet);
                                      }}
                                      className="text-xs text-accent mt-1 hover:underline"
                                    >
                                      {isExpanded ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                </div>

                                {/* Metadata */}
                                <div className="px-2 pb-2 space-y-1">
                                  <div className="flex items-center gap-2 text-xs text-foreground-muted">
                                    <span>{post.takenAt ? new Date(post.takenAt * 1000).toLocaleDateString() : 'No date'}</span>
                                    <span className="flex items-center gap-1">
                                      ❤️ {post.likeCount?.toLocaleString() || post.like_count?.toLocaleString() || 0}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      💬 {post.commentCount?.toLocaleString() || post.comment_count?.toLocaleString() || 0}
                                    </span>
                                  </div>
                                  {/* Post URL */}
                                  {(post.shortcode || post.code) && (
                                    <a
                                      href={`https://www.instagram.com/p/${post.shortcode || post.code}/`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-accent hover:underline block truncate"
                                    >
                                      instagram.com/p/{post.shortcode || post.code}
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* CARD 3: Comment Extraction */}
                <div className={cn(
                  "bg-background-elevated rounded-xl border-2 p-6 transition-all",
                  ctlActiveCard === 3 ? "border-accent shadow-lg shadow-accent/20" : "border-border"
                )}>
                  <h4 className="font-semibold text-foreground mb-2">3. Extract Leads</h4>
                  <p className="text-xs text-foreground-muted mb-4">Paste post link or configure extraction</p>

                  <div className="space-y-4">
                    {/* Direct Post Paste */}
                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-2">Or Paste Single Post Link</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://www.instagram.com/p/DOBY7Y4Eiyr/"
                          value={ctlPastedPostLinks}
                          onChange={(e) => {
                            setCtlPastedPostLinks(e.target.value);
                            setCtlActiveCard(3);
                          }}
                          className="bg-background text-foreground border-border text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={async () => {
                            const url = ctlPastedPostLinks.trim();
                            if (!url) return;

                            // Extract shortcode from URL
                            const match = url.match(/\/p\/([^\/]+)/);
                            if (!match) {
                              toast.error('Invalid Instagram post URL');
                              return;
                            }

                            const shortcode = match[1];
                            setCtlIsParsingPosts(true);

                            try {
                              const cookies = getCookies();
                              if (!cookies) {
                                toast.error('Session expired');
                                return;
                              }

                              // Fetch post by shortcode
                              toast.info('Fetching post details...');

                              const response = await fetch(`/api/instagram/cookie/post/${shortcode}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ cookies }),
                              });

                              const result = await response.json();

                              if (result.success && result.post) {
                                // Add post to target posts list
                                const newPost = {
                                  id: result.post.id,
                                  code: result.post.shortcode,
                                  caption: result.post.caption,
                                  commentCount: result.post.commentCount,
                                  imageUrl: result.post.displayUrl,
                                  likeCount: result.post.likeCount,
                                };

                                // Add to posts list and auto-select it
                                setCtlTargetPosts(prev => {
                                  // Check if post already exists
                                  if (prev.some(p => p.id === newPost.id)) {
                                    toast.warning('Post already added');
                                    return prev;
                                  }
                                  return [...prev, newPost];
                                });

                                setCtlSelectedPostIds(prev => new Set([...Array.from(prev), newPost.id]));
                                toast.success(`Added post with ${newPost.commentCount.toLocaleString()} comments`);
                                setCtlPastedPostLinks(''); // Clear input
                                setCtlActiveCard(3); // Move to next card
                              } else {
                                toast.error(result.error || 'Failed to fetch post');
                              }
                            } catch (e) {
                              console.error(e);
                              toast.error('Failed to fetch post');
                            } finally {
                              setCtlIsParsingPosts(false);
                            }
                          }}
                          disabled={!ctlPastedPostLinks.trim() || ctlIsParsingPosts}
                        >
                          {ctlIsParsingPosts ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Add'}
                        </Button>
                      </div>
                    </div>

                    {/* Summary */}
                    {ctlSelectedPostIds.size > 0 ? (
                      <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                        <p className="text-sm font-medium text-foreground">
                          {ctlSelectedPostIds.size} post{ctlSelectedPostIds.size > 1 ? 's' : ''} selected
                        </p>
                        <p className="text-xs text-foreground-muted mt-1">
                          ~{ctlTargetPosts.filter(p => ctlSelectedPostIds.has(p.id)).reduce((sum, p) => sum + (p.commentCount || 0), 0).toLocaleString()} comments
                        </p>
                      </div>
                    ) : (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">Select posts in Card 2</p>
                      </div>
                    )}

                    {/* Comment Date Filters */}
                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-2">Comment Date Range</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="date"
                            value={commentDateFrom}
                            onChange={(e) => {
                              setCommentDateFrom(e.target.value);
                              setCtlActiveCard(3);
                            }}
                            className="w-full px-2 py-1 bg-background text-foreground border border-border rounded text-xs"
                          />
                          <p className="text-xs text-foreground-muted mt-1">From</p>
                        </div>
                        <div>
                          <input
                            type="date"
                            value={commentDateTo}
                            onChange={(e) => {
                              setCommentDateTo(e.target.value);
                              setCtlActiveCard(3);
                            }}
                            className="w-full px-2 py-1 bg-background text-foreground border border-border rounded text-xs"
                          />
                          <p className="text-xs text-foreground-muted mt-1">To</p>
                        </div>
                      </div>
                    </div>

                    {/* Intent Keywords */}
                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-2">Intent Keywords</label>
                      <Input
                        value={commentIntentKeywords}
                        onChange={(e) => {
                          setCommentIntentKeywords(e.target.value);
                          setCtlActiveCard(3);
                        }}
                        placeholder="price, fiyat, details, ne kadar"
                        className="bg-background text-foreground border-border text-sm"
                      />
                      <p className="text-xs text-foreground-muted mt-1">Comma separated</p>
                    </div>

                    {/* Status */}
                    {ctlScrapingStatus && (
                      <div className="p-2 bg-background border border-border rounded text-sm text-foreground text-center">
                        {ctlScrapingStatus}
                      </div>
                    )}

                    {/* Extract Button */}
                    <Button
                      onClick={handleScrapeComments}
                      disabled={ctlSelectedPostIds.size === 0 || isSearching}
                      className="w-full bg-accent hover:bg-accent/90 text-white"
                    >
                      {isSearching ? (
                        <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Extracting...</>
                      ) : (
                        <><MessageSquare className="h-4 w-4 mr-2" /> Extract Leads</>
                      )}
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <Input
                  placeholder={
                    searchType === "username"
                      ? "Search target audience by name or niche..."
                      : searchType === "hashtag"
                        ? "Enter hashtag (e.g., entrepreneur)"
                        : "Enter username to get their followers/following"
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Reset target user when query changes for followers search
                    if (searchType === "followers") {
                      setTargetUserProfile(null);
                    }
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    (searchType === "followers"
                      ? handleLookupUser()
                      : handleSearch())
                  }
                  leftIcon={
                    searchType === "hashtag" ? (
                      <Hash className="h-4 w-4" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )
                  }
                />
              </div>
              {searchType === "followers" ? (
                <Button
                  onClick={handleLookupUser}
                  disabled={isLoadingTargetUser || !searchQuery.trim()}
                  variant="secondary"
                  className="w-full sm:w-auto">
                  {isLoadingTargetUser ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Lookup User</span>
                  <span className="sm:hidden">Lookup</span>
                </Button>
              ) : (
                <Button
                  data-search-btn
                  onClick={() => handleSearch()}
                  disabled={isSearching || !searchQuery.trim()}
                  className="w-full sm:w-auto">
                  {isSearching ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isSearching ? "Searching..." : "Search"}
                </Button>
              )}
            </div>
          )}

          {/* Followers/Following User Card */}
          {searchType === "followers" && targetUserProfile && (
            <div
              className={cn(
                "mb-4 p-4 rounded-xl border",
                targetUserProfile.isPrivate
                  ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20"
                  : "bg-gradient-to-r from-accent/10 to-purple-500/10 border-accent/20"
              )}>
              <div className="flex items-center gap-4">
                <Avatar
                  src={targetUserProfile.profilePicUrl}
                  name={targetUserProfile.username}
                  size="lg"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground text-lg">
                      @{targetUserProfile.username}
                    </h4>
                    {targetUserProfile.isVerified && (
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                    )}
                    {targetUserProfile.isPrivate && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                        🔒 Private
                      </span>
                    )}
                  </div>
                  <p className="text-foreground-muted">
                    {targetUserProfile.fullName}
                  </p>
                  {targetUserProfile.bio && (
                    <p className="text-sm text-foreground-subtle mt-1 line-clamp-2">
                      {targetUserProfile.bio}
                    </p>
                  )}
                </div>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {targetUserProfile.followerCount?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-foreground-muted">Followers</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {targetUserProfile.followingCount?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-foreground-muted">Following</p>
                  </div>
                </div>
              </div>

              {/* Private Account Warning */}
              {targetUserProfile.isPrivate && (
                <div
                  className={cn(
                    "mt-3 p-3 rounded-lg border",
                    targetUserProfile.followedByViewer
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-amber-500/10 border-amber-500/20"
                  )}>
                  <div className="flex items-start gap-2">
                    {targetUserProfile.followedByViewer ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-emerald-400">
                            Private Account - You Follow Them ✓
                          </p>
                          <p className="text-xs text-foreground-muted mt-1">
                            Your account (@{selectedAccount?.igUsername})
                            follows this user, so you can access their
                            followers/following list.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-400">
                            Private Account - Access Restricted
                          </p>
                          <p className="text-xs text-foreground-muted mt-1">
                            Your account (@{selectedAccount?.igUsername})
                            doesn't follow this user. Instagram will block
                            access to their followers/following list.
                            <br />
                            <span className="text-amber-400">
                              Tip: Follow this account first to gain access.
                            </span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Followers/Following Toggle */}
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-foreground-muted">Get:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFollowListType("followers")}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      followListType === "followers"
                        ? "bg-accent text-white"
                        : "bg-background text-foreground-muted hover:text-foreground"
                    )}>
                    <Users className="h-4 w-4 inline mr-1" />
                    Followers (
                    {targetUserProfile.followerCount?.toLocaleString() || 0})
                  </button>
                  <button
                    onClick={() => setFollowListType("following")}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      followListType === "following"
                        ? "bg-accent text-white"
                        : "bg-background text-foreground-muted hover:text-foreground"
                    )}>
                    <UserPlus className="h-4 w-4 inline mr-1" />
                    Following (
                    {targetUserProfile.followingCount?.toLocaleString() || 0})
                  </button>
                </div>
                <Button
                  onClick={() => handleSearch()}
                  disabled={
                    isSearching ||
                    (targetUserProfile.isPrivate &&
                      !targetUserProfile.followedByViewer)
                  }
                  className="ml-auto">
                  {isSearching ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isSearching
                    ? "Loading..."
                    : `Get ${followListType === "followers"
                      ? "Followers"
                      : "Following"
                    }`}
                </Button>
              </div>
            </div>
          )}

          {/* Target Audience Presets */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground-muted mb-2">
              🎯 Quick Select Target Audience
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {KEYWORD_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    if (selectedPreset === preset.name) {
                      setSelectedPreset(null);
                    } else {
                      setSelectedPreset(preset.name);
                      // Auto-search with the first keyword as hashtag
                      const firstKeyword = preset.keywords[0].replace(
                        /\s+/g,
                        ""
                      );
                      setSearchType("hashtag");
                      setSearchQuery(firstKeyword);
                      // Directly call search with the query
                      handleSearch(false, firstKeyword, "hashtag");
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    selectedPreset === preset.name
                      ? "bg-accent text-white shadow-lg shadow-accent/30"
                      : "bg-background-elevated text-foreground-muted hover:text-foreground hover:bg-background-elevated/80"
                  )}>
                  <span>{preset.icon}</span>
                  {preset.name}
                </button>
              ))}
            </div>
            {selectedPreset && (
              <div className="mb-3 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-sm text-accent font-medium mb-1">
                  🎯 Target: {selectedPreset}
                </p>
                <p className="text-xs text-foreground-muted">
                  Bio filter keywords:{" "}
                  {KEYWORD_PRESETS.find((p) => p.name === selectedPreset)
                    ?.keywords.slice(0, 5)
                    .join(", ")}
                  ...
                </p>
              </div>
            )}
          </div>

          {/* Custom Keywords Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground-muted mb-2">
              ➕ Additional Keywords (optional)
            </label>
            <Input
              placeholder="e.g., saas, b2b, growth hacker"
              value={bioKeywords}
              onChange={(e) => setBioKeywords(e.target.value)}
            />
            <p className="text-xs text-foreground-subtle mt-1">
              Add custom keywords to combine with the selected preset (comma
              separated)
            </p>
          </div>

          {/* Error Message */}
          {searchError && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium">{searchError}</p>
              </div>
              {searchError.includes("session") && (
                <div className="mt-2 ml-7">
                  <a
                    href="/settings/instagram"
                    className="text-xs text-red-300 hover:text-red-200 underline">
                    Go to Instagram Settings to reconnect →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Search Results */}
          {(searchResults.length > 0 || displayedSearchResults.length > 0) && (
            <div className="border-t border-border pt-4">
              {/* Search info header */}
              {searchResults.length > 0 && displayedSearchResults.length === 0 && !isLoadingBatch && (
                <div className="mb-4 p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-sm text-accent font-medium">
                    ✨ Found {searchResults.length} profiles. Loading first {Math.min(batchSize, searchResults.length)}...
                  </p>
                </div>
              )}

              {/* Loading indicator */}
              {isLoadingBatch && (
                <div className="mb-4 p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-accent animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-accent font-medium">
                        Loading profile {loadingProgress.current} of {loadingProgress.total}...
                      </p>
                      <div className="mt-2 bg-background-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-accent h-full transition-all duration-300"
                          style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Displayed results */}
              {displayedSearchResults.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-foreground">
                        Loaded {displayedSearchResults.length} of {searchResults.length} profiles
                      </h4>
                      <div className="flex gap-3 mt-1">
                        {searchType === "hashtag" && (
                          <span className="text-xs text-foreground-muted flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {
                              displayedSearchResults.filter(
                                (u) =>
                                  u.source === "bio_match" || u.source === "hashtag"
                              ).length
                            }{" "}
                            from bio search
                          </span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleAddLeads(displayedSearchResults)} disabled={isLoadingBatch}>
                      <UserPlus className="h-4 w-4" />
                      Add All {displayedSearchResults.length} as Leads
                    </Button>
                  </div>

                  {/* Results Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                    {displayedSearchResults.map((user, i) => (
                      <div
                        key={`${user.pk}-${i}`}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          user.source === "bio_match"
                            ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                            : "bg-background-elevated border-border hover:bg-background-elevated/80"
                        )}>
                        <div className="flex items-start gap-3">
                          <Avatar
                            src={user.profilePicUrl}
                            name={user.username}
                            size="md"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-foreground truncate">
                                @{user.username}
                              </p>
                              {user.isVerified && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                              )}
                              {user.isPrivate && (
                                <span className="text-xs text-amber-400">🔒</span>
                              )}
                            </div>
                            <p className="text-xs text-foreground-muted truncate">
                              {user.fullName}
                            </p>

                            {/* Follower count */}
                            {user.followerCount && (
                              <p className="text-xs text-foreground-subtle mt-1">
                                {user.followerCount.toLocaleString()} followers
                              </p>
                            )}

                            {/* Bio preview */}
                            {user.bio && (
                              <p className="text-xs text-foreground-muted mt-1 line-clamp-2">
                                {user.bio}
                              </p>
                            )}

                            {/* Source & Matched keyword badges */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {user.source && (
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                    user.source === "bio_match"
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : "bg-accent/20 text-accent"
                                  )}>
                                  {user.source === "bio_match"
                                    ? "📝 Bio match"
                                    : "#️⃣ Hashtag"}
                                </span>
                              )}
                              {user.matchedKeyword && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-medium">
                                  ✓ {user.matchedKeyword}
                                </span>
                              )}
                            </div>

                            {/* View Profile Button */}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="mt-2 w-full text-xs"
                              onClick={() => {
                                setProfileModalUsername(user.username);
                                setShowLeadProfileModal(true);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Profile
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Load More Button */}
                  {currentBatchIndex < searchResults.length && !isLoadingBatch && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => loadNextBatch(moreBatchSize)}
                        disabled={isLoadingBatch}
                      >
                        Load {Math.min(moreBatchSize, searchResults.length - currentBatchIndex)} More
                        ({searchResults.length - currentBatchIndex} remaining)
                      </Button>
                      <p className="text-xs text-foreground-muted">
                        Each profile loads with 5-15 second delay for safety
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Old Search Results (shown only when not using batch loading) */}
          {searchResults.length > 0 && displayedSearchResults.length === 0 && !isLoadingBatch && false && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-foreground">
                    Found {searchResults.length} potential leads
                  </h4>
                  <div className="flex gap-3 mt-1">
                    {searchType === "hashtag" && (
                      <span className="text-xs text-foreground-muted flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {
                          searchResults.filter(
                            (u) =>
                              u.source === "bio_match" || u.source === "hashtag"
                          ).length
                        }{" "}
                        from bio search
                      </span>
                    )}
                    {hasMoreResults && (
                      <span className="text-xs text-accent">
                        More available
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleAddLeads(searchResults)}>
                  <UserPlus className="h-4 w-4" />
                  Add All {searchResults.length} as Leads
                </Button>
              </div>

              {/* Results Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                {searchResults.map((user, i) => (
                  <div
                    key={`${user.pk}-${i}`}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      user.source === "bio_match"
                        ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                        : "bg-background-elevated border-border hover:bg-background-elevated/80"
                    )}>
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={user.profilePicUrl}
                        name={user.username}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">
                            @{user.username}
                          </p>
                          {user.isVerified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                          )}
                          {user.isPrivate && (
                            <span className="text-xs text-amber-400">🔒</span>
                          )}
                        </div>
                        <p className="text-xs text-foreground-muted truncate">
                          {user.fullName}
                        </p>

                        {/* Follower count */}
                        {user.followerCount && (
                          <p className="text-xs text-foreground-subtle mt-1">
                            {user.followerCount.toLocaleString()} followers
                          </p>
                        )}

                        {/* Bio preview */}
                        {user.bio && (
                          <p className="text-xs text-foreground-muted mt-1 line-clamp-2">
                            {user.bio}
                          </p>
                        )}

                        {/* Source & Matched keyword badges */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {user.source && (
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                user.source === "bio_match"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-accent/20 text-accent"
                              )}>
                              {user.source === "bio_match"
                                ? "📝 Bio match"
                                : "#️⃣ Hashtag"}
                            </span>
                          )}
                          {user.matchedKeyword && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-medium">
                              ✓ {user.matchedKeyword}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More / Stats */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-foreground-muted">
                  Showing {searchResults.length} users
                  {searchType !== "username" && ` • Limit: ${searchLimit}`}
                </p>
                {searchType !== "username" && hasMoreResults && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSearch(true)}
                    disabled={isLoadingMore}>
                    {isLoadingMore ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Load 50 More
                      </>
                    )}
                  </Button>
                )}
                {!hasMoreResults && searchResults.length >= searchLimit && (
                  <span className="text-sm text-emerald-400">
                    ✓ All available results loaded
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Leads List */}
        <div className="bg-background-secondary rounded-xl border border-border">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Your Leads ({processedLeads.length})
              </h3>

              {/* Actions */}
              {selectedLeads.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-muted">
                    {selectedLeads.size} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setShowBulkActionsModal(true)}>
                    <Filter className="h-4 w-4" />
                    Bulk Actions
                  </Button>
                  <Button size="sm" onClick={() => setShowBulkDmModal(true)}>
                    <Send className="h-4 w-4" />
                    Send DM
                  </Button>
                  <Button size="sm" onClick={handleExportLeads}>
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button size="sm" onClick={() => setShowLeadListsModal(true)}>
                    <List className="h-4 w-4" />
                    Add to List
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDeleteLeads}
                    className="text-error">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Search and Filters Row */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
              {/* Search Leads */}
              <div className="flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
                <Input
                  placeholder="Search leads by name, username, or bio..."
                  value={leadsSearchQuery}
                  onChange={(e) => setLeadsSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm w-full sm:w-auto">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="followers">Most Followers</option>
                <option value="name">Name A-Z</option>
                <option value="score">Lead Score</option>
                <option value="engagement">Engagement Rate</option>
              </select>

              {/* Advanced Filters Toggle */}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="w-full sm:w-auto">
                <Filter className="h-4 w-4 mr-2" />
                {showAdvancedFilters ? "Hide" : "Advanced"} Filters
              </Button>

              {/* Status Filter */}
              <div className="flex flex-wrap gap-1">
                {["all", "new", "contacted", "replied", "converted"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        statusFilter === status
                          ? "bg-accent text-white"
                          : "bg-background-elevated text-foreground-muted hover:text-foreground"
                      )}>
                      {status === "all"
                        ? "All"
                        : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="p-4 bg-background-elevated rounded-lg border border-border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Follower Range */}
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-2">
                      Followers Range
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={followerRange?.[0] || ""}
                        onChange={(e) =>
                          setFollowerRange([
                            e.target.value ? parseInt(e.target.value) : 0,
                            followerRange?.[1] || 1000000,
                          ])
                        }
                        className="w-full"
                      />
                      <span className="text-foreground-muted">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={followerRange?.[1] || ""}
                        onChange={(e) =>
                          setFollowerRange([
                            followerRange?.[0] || 0,
                            e.target.value ? parseInt(e.target.value) : 1000000,
                          ])
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Engagement Rate Range */}
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-2">
                      Engagement Rate (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Min"
                        value={engagementRateRange?.[0] || ""}
                        onChange={(e) =>
                          setEngagementRateRange([
                            e.target.value ? parseFloat(e.target.value) : 0,
                            engagementRateRange?.[1] || 10,
                          ])
                        }
                        className="w-full"
                      />
                      <span className="text-foreground-muted">-</span>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Max"
                        value={engagementRateRange?.[1] || ""}
                        onChange={(e) =>
                          setEngagementRateRange([
                            engagementRateRange?.[0] || 0,
                            e.target.value ? parseFloat(e.target.value) : 10,
                          ])
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Account Age Range */}
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-2">
                      Account Age (days)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={accountAgeRange?.[0] || ""}
                        onChange={(e) =>
                          setAccountAgeRange([
                            e.target.value ? parseInt(e.target.value) : 0,
                            accountAgeRange?.[1] || 3650,
                          ])
                        }
                        className="w-full"
                      />
                      <span className="text-foreground-muted">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={accountAgeRange?.[1] || ""}
                        onChange={(e) =>
                          setAccountAgeRange([
                            accountAgeRange?.[0] || 0,
                            e.target.value ? parseInt(e.target.value) : 3650,
                          ])
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Post Frequency Range */}
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-2">
                      Post Frequency (per week)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Min"
                        value={postFrequencyRange?.[0] || ""}
                        onChange={(e) =>
                          setPostFrequencyRange([
                            e.target.value ? parseFloat(e.target.value) : 0,
                            postFrequencyRange?.[1] || 10,
                          ])
                        }
                        className="w-full"
                      />
                      <span className="text-foreground-muted">-</span>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Max"
                        value={postFrequencyRange?.[1] || ""}
                        onChange={(e) =>
                          setPostFrequencyRange([
                            postFrequencyRange?.[0] || 0,
                            e.target.value ? parseFloat(e.target.value) : 10,
                          ])
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Minimum Lead Score */}
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-2">
                      Minimum Lead Score
                    </label>
                    <Input
                      type="number"
                      placeholder="0-100"
                      min="0"
                      max="100"
                      value={minLeadScore || ""}
                      onChange={(e) =>
                        setMinLeadScore(
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Estate Category Filter */}
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-2">
                      Estate Category
                    </label>
                    <select
                      value={estateCategoryFilter}
                      onChange={(e) => setEstateCategoryFilter(e.target.value as 'all' | 'sale' | 'rent')}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm w-full">
                      <option value="all">All Categories</option>
                      <option value="sale">🏷️ For Sale (Satılık)</option>
                      <option value="rent">🏠 For Rent (Kiralık)</option>
                    </select>
                  </div>

                  {/* City Filter */}
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-2">
                      City
                    </label>
                    <select
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm w-full">
                      <option value="all">All Cities</option>
                      {uniqueCities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  {/* Caption/Notes Search */}
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-2">
                      Search in Caption/Notes
                    </label>
                    <Input
                      type="text"
                      placeholder="Keywords in caption..."
                      value={captionSearchTerm}
                      onChange={(e) => setCaptionSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFollowerRange(null);
                      setEngagementRateRange(null);
                      setAccountAgeRange(null);
                      setPostFrequencyRange(null);
                      setMinLeadScore(null);
                      setMinLeadScore(null);
                      setEstateCategoryFilter('all');
                      setCityFilter('all');
                      setCaptionSearchTerm('');
                    }}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Card View / Desktop Table */}
          {isLoading ? (
            <div className="p-8 text-center text-foreground-muted">
              Loading leads...
            </div>
          ) : processedLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-foreground-subtle mx-auto mb-3" />
              <p className="text-foreground-muted">
                No leads yet. Use the search above to find potential customers.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-4">
                {displayedLeads.map((lead) => (
                  <MobileLeadCard
                    key={lead.id}
                    lead={lead}
                    isSelected={selectedLeads.has(lead.id)}
                    onSelect={toggleLeadSelection}
                    onViewProfile={handleViewProfile}
                  />
                ))}
                {hasMoreLeads && (
                  <div className="pt-4">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleLoadMore}
                      className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Load{" "}
                      {Math.min(
                        leadsPerBatch,
                        processedLeads.length - displayedLeads.length
                      )}{" "}
                      More
                    </Button>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="p-2 md:p-4">
                        <input
                          type="checkbox"
                          checked={
                            selectedLeads.size === leads.length &&
                            leads.length > 0
                          }
                          onChange={toggleSelectAll}
                          className="rounded border-border"
                        />
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase">
                        User
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden md:table-cell">
                        Score
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden md:table-cell">
                        Bio Keywords
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden lg:table-cell">
                        Tags
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden md:table-cell">
                        Status
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden md:table-cell">
                        Listing Type
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden lg:table-cell">
                        Property
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden lg:table-cell">
                        Location
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden xl:table-cell">
                        Comment Date
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden xl:table-cell">
                        Post Caption
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden xl:table-cell">
                        Links
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase hidden md:table-cell">
                        Source
                      </th>
                      <th className="p-2 md:p-4 text-xs font-medium text-foreground-muted uppercase text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-background-elevated/50">
                        <td className="p-2 md:p-4">
                          <input
                            type="checkbox"
                            checked={selectedLeads.has(lead.id)}
                            onChange={() => toggleLeadSelection(lead.id)}
                            className="rounded border-border"
                          />
                        </td>
                        <td className="p-2 md:p-4">
                          <div className="flex items-center gap-2 md:gap-3">
                            <Avatar
                              src={lead.profilePicUrl}
                              name={lead.igUsername}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground flex items-center gap-1 truncate">
                                @{lead.igUsername}
                                {lead.isVerified && (
                                  <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                                )}
                              </p>
                              <p className="text-xs md:text-sm text-foreground-muted truncate">
                                {lead.fullName}
                              </p>
                              {/* Show followers on mobile in user cell */}
                              <p className="text-xs text-foreground-subtle lg:hidden mt-0.5">
                                {lead.followerCount?.toLocaleString() || "-"}{" "}
                                followers
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 md:p-4 hidden md:table-cell">
                          {lead.leadScore !== undefined && lead.leadScore !== null ? (
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  lead.leadScore >= 70
                                    ? "text-emerald-400"
                                    : lead.leadScore >= 50
                                      ? "text-amber-400"
                                      : "text-foreground-muted"
                                )}
                              >
                                {lead.leadScore}
                              </span>
                            </div>
                          ) : (
                            <span className="text-foreground-subtle">-</span>
                          )}
                        </td>
                        <td className="p-2 md:p-4 hidden md:table-cell">
                          {lead.matchedKeywords?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {lead.matchedKeywords.slice(0, 3).map((k, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-background/50">
                                  {k}
                                </Badge>
                              ))}
                              {lead.matchedKeywords.length > 3 && (
                                <span className="text-[10px] text-foreground-muted">+{lead.matchedKeywords.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-foreground-subtle text-xs">-</span>
                          )}
                        </td>
                        <td className="p-2 md:p-4 hidden lg:table-cell">
                          {lead.tags?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {lead.tags.slice(0, 2).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-foreground-subtle text-xs">-</span>
                          )}
                        </td>
                        <td className="p-2 md:p-4 hidden md:table-cell">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                              statusColors[lead.status]?.bg,
                              statusColors[lead.status]?.text
                            )}
                          >
                            {statusColors[lead.status]?.label || lead.status}
                          </span>
                        </td>
                        <td className="p-2 md:p-4 hidden md:table-cell">
                          {lead.listingType ? (
                            <Badge variant={lead.listingType === 'Sale' ? 'default' : 'secondary'} className={cn("text-[10px]", lead.listingType === 'Sale' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20')}>
                              {lead.listingType === 'Sale' ? 'Satılık' : 'Kiralık'}
                            </Badge>
                          ) : (
                            <span className="text-foreground-subtle text-xs">-</span>
                          )}
                        </td>
                        <td className="p-2 md:p-4 hidden lg:table-cell">
                          <div className="flex flex-col">
                            {lead.propertyType && <span className="text-xs font-medium">{lead.propertyType}</span>}
                            {lead.propertySubType && <span className="text-[10px] text-foreground-muted">{lead.propertySubType}</span>}
                            {!lead.propertyType && !lead.propertySubType && <span className="text-foreground-subtle text-xs">-</span>}
                          </div>
                        </td>
                        <td className="p-2 md:p-4 hidden lg:table-cell">
                          {lead.city ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{lead.city}</span>
                              {lead.town && <span className="text-[10px] text-foreground-muted">{lead.town}</span>}
                            </div>
                          ) : (
                            <span className="text-foreground-subtle text-xs">-</span>
                          )}
                        </td>
                        <td className="p-2 md:p-4 hidden xl:table-cell">
                          {lead.commentDate ? (
                            <span className="text-xs text-foreground-muted">
                              {new Date(lead.commentDate).toLocaleDateString('tr-TR')}
                            </span>
                          ) : (
                            <span className="text-foreground-subtle text-xs">-</span>
                          )}
                        </td>
                        <td className="p-2 md:p-4 hidden xl:table-cell max-w-[200px]">
                          {(lead.postCaption || lead.notes) ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-foreground truncate block" title={lead.postCaption || lead.notes}>
                                {(lead.postCaption || lead.notes?.split('\n')[0] || '').replace(/^[\"\']|[\"\']$/g, '')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-foreground-subtle">-</span>
                          )}
                        </td>
                        <td className="p-2 md:p-4 hidden xl:table-cell">
                          <div className="flex gap-2">
                            {lead.postLink && (
                              <a
                                href={lead.postLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-600 flex items-center gap-1 text-[10px]"
                                title="View Post"
                              >
                                <span className="hidden xl:inline">Post</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                            )}
                            {lead.commentLink && (
                              <a
                                href={lead.commentLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-500 hover:text-purple-600 flex items-center gap-1 text-[10px]"
                                title="View Comment"
                              >
                                <span className="hidden xl:inline">Comment</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                              </a>
                            )}
                            {!lead.postLink && !lead.commentLink && <span className="text-foreground-subtle text-xs">-</span>}
                          </div>
                        </td>
                        <td className="p-2 md:p-4 hidden md:table-cell">
                          <span className="text-xs text-foreground-muted truncate block max-w-[100px]" title={lead.sourceQuery || lead.source}>
                            {lead.sourceQuery ? lead.sourceQuery.replace('Comment Match:', 'Match:') : lead.source}
                          </span>
                        </td>
                        <td className="p-2 md:p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewProfile(lead)}
                              title="View Lead Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setProfileModalUsername(lead.igUsername);
                                setShowLeadProfileModal(true);
                              }}
                              title="View Fresh Profile (Scraped from Instagram)"
                              className="text-accent hover:text-accent/80">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `https://instagram.com/${lead.igUsername}`,
                                  "_blank"
                                )
                              }
                              title="Open on Instagram">
                              <Instagram className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Load More Button */}
          {hasMoreLeads && (
            <div className="p-4 border-t border-border flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="text-sm text-foreground-muted">
                  Showing {displayedLeads.length} of {processedLeads.length}{" "}
                  leads
                </div>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleLoadMore}
                  className="min-w-[200px]">
                  <Plus className="h-4 w-4 mr-2" />
                  Load{" "}
                  {Math.min(
                    leadsPerBatch,
                    processedLeads.length - displayedLeads.length
                  )}{" "}
                  More
                </Button>
              </div>
            </div>
          )}

          {!hasMoreLeads && processedLeads.length > 0 && (
            <div className="p-4 border-t border-border text-center text-sm text-foreground-muted">
              Showing all {processedLeads.length} leads
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Modal */}
      {
        showBulkActionsModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-background-secondary rounded-2xl border border-border max-w-md w-full">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">
                  Bulk Actions
                </h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Apply action to {selectedLeads.size} selected leads
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-2">
                    Action Type
                  </label>
                  <select
                    value={bulkActionType || ""}
                    onChange={(e) => {
                      setBulkActionType(
                        e.target.value as "status" | "tags" | null
                      );
                      setBulkActionValue("");
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground">
                    <option value="">Select action...</option>
                    <option value="status">Update Status</option>
                    <option value="tags">Add Tags</option>
                  </select>
                </div>

                {bulkActionType === "status" && (
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-2">
                      New Status
                    </label>
                    <select
                      value={bulkActionValue}
                      onChange={(e) => setBulkActionValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground">
                      <option value="">Select status...</option>
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="replied">Replied</option>
                      <option value="converted">Converted</option>
                      <option value="unsubscribed">Unsubscribed</option>
                    </select>
                  </div>
                )}

                {bulkActionType === "tags" && (
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-2">
                      Tags (comma-separated)
                    </label>
                    <Input
                      value={bulkActionValue}
                      onChange={(e) => setBulkActionValue(e.target.value)}
                      placeholder="tag1, tag2, tag3"
                    />
                    <p className="text-xs text-foreground-subtle mt-1">
                      Separate multiple tags with commas
                    </p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-border flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowBulkActionsModal(false);
                    setBulkActionType(null);
                    setBulkActionValue("");
                  }}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleBulkAction}
                  disabled={
                    !bulkActionType ||
                    !bulkActionValue.trim() ||
                    isPerformingBulkAction
                  }>
                  {isPerformingBulkAction ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Bulk DM Modal */}
      {
        showBulkDmModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-background-secondary rounded-2xl border border-border max-w-md w-full">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">
                  Send Bulk DM
                </h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Send a message to {selectedLeads.size} selected leads
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-2">
                    Message
                  </label>
                  <textarea
                    value={bulkDmMessage}
                    onChange={(e) => setBulkDmMessage(e.target.value)}
                    placeholder="Hi {{name}}, I noticed you're in the business space..."
                    rows={5}
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder-foreground-subtle focus:border-accent outline-none resize-none"
                  />
                  <p className="text-xs text-foreground-subtle mt-1">
                    Use {"{{name}}"} to personalize with their name
                  </p>
                </div>
              </div>
              <div className="p-6 border-t border-border flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowBulkDmModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSendBulkDm}
                  disabled={!bulkDmMessage.trim() || isSendingBulkDm}>
                  {isSendingBulkDm ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSendingBulkDm
                    ? "Sending..."
                    : `Send to ${selectedLeads.size} leads`}
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Lead Lists Modal */}
      {
        showLeadListsModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-background-secondary rounded-2xl border border-border max-w-md w-full">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Add to List
                  </h2>
                  <p className="text-sm text-foreground-muted mt-1">
                    Add {selectedLeads.size} selected leads to a list
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowLeadListsModal(false);
                    setShowCreateListModal(true);
                  }}>
                  <Plus className="h-4 w-4" />
                  New List
                </Button>
              </div>
              <div className="p-6 max-h-[400px] overflow-y-auto">
                {isLoadingLists ? (
                  <div className="text-center py-4 text-foreground-muted">
                    Loading lists...
                  </div>
                ) : leadLists.length === 0 ? (
                  <div className="text-center py-8">
                    <List className="h-12 w-12 text-foreground-subtle mx-auto mb-3" />
                    <p className="text-foreground-muted mb-4">No lists yet</p>
                    <Button
                      onClick={() => {
                        setShowLeadListsModal(false);
                        setShowCreateListModal(true);
                      }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First List
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leadLists.map((list: any) => (
                      <button
                        key={list.id}
                        onClick={() => handleAddToList(list.id)}
                        className="w-full p-3 rounded-lg bg-background-elevated hover:bg-background border border-border text-left transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">
                              {list.name}
                            </p>
                            {list.description && (
                              <p className="text-xs text-foreground-muted mt-1">
                                {list.description}
                              </p>
                            )}
                            <p className="text-xs text-foreground-subtle mt-1">
                              {list.members?.length || 0} leads
                            </p>
                          </div>
                          <Plus className="h-4 w-4 text-foreground-muted" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-border">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShowLeadListsModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Create List Modal */}
      {
        showCreateListModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-background-secondary rounded-2xl border border-border max-w-md w-full">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Create Lead List
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateListModal(false);
                    setNewListName("");
                    setNewListDescription("");
                  }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-2">
                    List Name
                  </label>
                  <Input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="My Lead List"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="Description of this list..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder-foreground-subtle focus:border-accent outline-none resize-none"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-border flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateListModal(false);
                    setNewListName("");
                    setNewListDescription("");
                  }}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}>
                  Create List
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Profile Modal */}
      {
        showProfileModal && selectedProfile && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-background-secondary rounded-2xl border border-border max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-border flex items-center gap-4">
                <Avatar
                  src={selectedProfile.profilePicUrl}
                  name={selectedProfile.igUsername}
                  size="xl"
                />
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    @{selectedProfile.igUsername}
                    {selectedProfile.isVerified && (
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                    )}
                  </h2>
                  <p className="text-foreground-muted">
                    {selectedProfile.fullName}
                  </p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {isLoadingProfile ? (
                  <div className="text-center py-4 text-foreground-muted">
                    Loading profile...
                  </div>
                ) : (
                  <>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 rounded-lg bg-background-elevated">
                        <p className="text-xl font-bold text-foreground">
                          {selectedProfile.followerCount?.toLocaleString() || "-"}
                        </p>
                        <p className="text-xs text-foreground-muted">Followers</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-background-elevated">
                        <p className="text-xl font-bold text-foreground">
                          {selectedProfile.followingCount?.toLocaleString() ||
                            "-"}
                        </p>
                        <p className="text-xs text-foreground-muted">Following</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-background-elevated">
                        <p className="text-xl font-bold text-foreground">
                          {selectedProfile.postCount?.toLocaleString() || "-"}
                        </p>
                        <p className="text-xs text-foreground-muted">Posts</p>
                      </div>
                    </div>

                    {/* Lead Score & Engagement */}
                    {((selectedProfile.leadScore !== undefined &&
                      selectedProfile.leadScore !== null) ||
                      (selectedProfile.engagementRate !== undefined &&
                        selectedProfile.engagementRate !== null)) && (
                        <div className="grid grid-cols-2 gap-4">
                          {selectedProfile.leadScore !== undefined &&
                            selectedProfile.leadScore !== null && (
                              <div className="p-3 rounded-lg bg-background-elevated">
                                <p className="text-sm text-foreground-muted mb-1">
                                  Lead Score
                                </p>
                                <p
                                  className={cn(
                                    "text-2xl font-bold",
                                    selectedProfile.leadScore >= 70
                                      ? "text-emerald-400"
                                      : selectedProfile.leadScore >= 50
                                        ? "text-amber-400"
                                        : "text-foreground-muted"
                                  )}>
                                  {selectedProfile.leadScore}/100
                                </p>
                              </div>
                            )}
                          {selectedProfile.engagementRate !== undefined &&
                            selectedProfile.engagementRate !== null && (
                              <div className="p-3 rounded-lg bg-background-elevated">
                                <p className="text-sm text-foreground-muted mb-1">
                                  Engagement Rate
                                </p>
                                <p className="text-2xl font-bold text-foreground">
                                  {selectedProfile.engagementRate.toFixed(1)}%
                                </p>
                              </div>
                            )}
                        </div>
                      )}

                    {/* Lead History */}
                    {(selectedProfile.timesContacted ||
                      selectedProfile.lastContactedAt ||
                      selectedProfile.lastInteractionAt) && (
                        <div className="p-4 rounded-lg bg-background-elevated border border-border">
                          <h4 className="text-sm font-medium text-foreground-muted mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Interaction History
                          </h4>
                          <div className="space-y-2">
                            {selectedProfile.timesContacted !== undefined &&
                              selectedProfile.timesContacted > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-foreground-muted">
                                    Times Contacted
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {selectedProfile.timesContacted}
                                  </span>
                                </div>
                              )}
                            {selectedProfile.lastContactedAt && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground-muted">
                                  Last Contacted
                                </span>
                                <span className="font-medium text-foreground">
                                  {new Date(
                                    selectedProfile.lastContactedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {selectedProfile.lastInteractionAt && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground-muted">
                                  Last Interaction
                                </span>
                                <span className="font-medium text-foreground">
                                  {new Date(
                                    selectedProfile.lastInteractionAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {selectedProfile.dmSentAt && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground-muted flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  DM Sent
                                </span>
                                <span className="font-medium text-foreground">
                                  {new Date(
                                    selectedProfile.dmSentAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {selectedProfile.dmRepliedAt && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground-muted flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  Replied
                                </span>
                                <span className="font-medium text-emerald-400">
                                  {new Date(
                                    selectedProfile.dmRepliedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Enrichment Data */}
                    {(selectedProfile.email ||
                      selectedProfile.phone ||
                      selectedProfile.website ||
                      selectedProfile.location) && (
                        <div>
                          <h4 className="text-sm font-medium text-foreground-muted mb-2">
                            Contact Information
                          </h4>
                          <div className="space-y-1 text-sm">
                            {selectedProfile.email && (
                              <p className="text-foreground">
                                <span className="text-foreground-muted">
                                  Email:{" "}
                                </span>
                                {selectedProfile.email}
                              </p>
                            )}
                            {selectedProfile.phone && (
                              <p className="text-foreground">
                                <span className="text-foreground-muted">
                                  Phone:{" "}
                                </span>
                                {selectedProfile.phone}
                              </p>
                            )}
                            {selectedProfile.website && (
                              <p className="text-foreground">
                                <span className="text-foreground-muted">
                                  Website:{" "}
                                </span>
                                <a
                                  href={selectedProfile.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent hover:underline">
                                  {selectedProfile.website}
                                </a>
                              </p>
                            )}
                            {selectedProfile.location && (
                              <p className="text-foreground">
                                <span className="text-foreground-muted">
                                  Location:{" "}
                                </span>
                                {selectedProfile.location}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Bio */}
                    {selectedProfile.bio && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground-muted mb-2">
                          Bio
                        </h4>
                        <p className="text-foreground whitespace-pre-wrap">
                          {selectedProfile.bio}
                        </p>
                      </div>
                    )}

                    {/* Matched Keywords */}
                    {selectedProfile.matchedKeywords?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground-muted mb-2">
                          Matched Keywords
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedProfile.matchedKeywords.map(
                            (kw: string, i: number) => (
                              <Badge key={i} variant="success">
                                {kw}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {selectedProfile.isPrivate && (
                        <Badge variant="warning">Private</Badge>
                      )}
                      {selectedProfile.isBusiness && (
                        <Badge variant="accent">Business</Badge>
                      )}
                      {selectedProfile.isVerified && (
                        <Badge variant="success">Verified</Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="p-6 border-t border-border flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowProfileModal(false)}>
                  Close
                </Button>
                <Button
                  className="flex-1"
                  onClick={() =>
                    window.open(
                      `https://instagram.com/${selectedProfile.igUsername}`,
                      "_blank"
                    )
                  }>
                  <Instagram className="h-4 w-4" />
                  View on Instagram
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Lead Profile Modal (No-Auth Scraper) */}
      <LeadProfileModal
        username={profileModalUsername}
        isOpen={showLeadProfileModal}
        onClose={() => {
          setShowLeadProfileModal(false);
          setProfileModalUsername('');
        }}
        onAddToLeads={async (username) => {
          // Add single lead from modal
          const user = displayedSearchResults.find(u => u.username === username);
          if (user) {
            await handleAddLeads([user]);
          }
          setShowLeadProfileModal(false);
        }}
        isAlreadyLead={leads.some(l => l.igUsername === profileModalUsername)}
      />
    </div >
  );
}

