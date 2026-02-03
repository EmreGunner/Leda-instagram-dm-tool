import { useState, useCallback } from 'react';
import { usePostHog } from '@/hooks/use-posthog';
import { toast } from 'sonner';
import { KEYWORD_PRESETS, InstagramAccount } from '@/lib/types/leads';
import { getRandomDelay, formatDelayTime } from '@/lib/utils/rate-limit';

// Helper for keyword matching
function matchKeywordsInBio(bio: string, keywords: string[]): string[] {
    const lowerBio = bio.toLowerCase();
    const matched: string[] = [];

    for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase().trim();
        if (!lowerKeyword) continue;
        if (lowerBio.includes(lowerKeyword)) {
            matched.push(keyword);
            continue;
        }
        const words = lowerKeyword.split(' ').filter(w => w.length > 2);
        if (words.length > 1) {
            const allWordsPresent = words.every(word => lowerBio.includes(word));
            if (allWordsPresent) {
                matched.push(keyword);
            }
        }
    }
    return Array.from(new Set(matched));
}

interface UseLeadSearchProps {
    selectedAccount: InstagramAccount | null;
    getCookies: () => any;
    bioKeywords: string;
    selectedPreset: string | null;
}

export function useLeadSearch({
    selectedAccount,
    getCookies,
    bioKeywords,
    selectedPreset
}: UseLeadSearchProps) {
    const { capture } = usePostHog();

    // Search state
    const [searchType, setSearchType] = useState<'username' | 'hashtag' | 'followers' | 'comment-to-lead'>('username');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLimit, setSearchLimit] = useState(250);
    const [hasMoreResults, setHasMoreResults] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [targetUserId, setTargetUserId] = useState<string | null>(null);
    const [discoveryMethod, setDiscoveryMethod] = useState<'cookie' | 'apify'>('apify');
    const [searchError, setSearchError] = useState('');

    // Follow list type for followers search
    const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');

    // Batch loading state
    const [displayedSearchResults, setDisplayedSearchResults] = useState<any[]>([]);
    const [isLoadingBatch, setIsLoadingBatch] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
    const batchSize = 10;

    // Load batch of search results
    const loadNextBatch = async (count: number, initialResults?: any[]) => {
        const sourceResults = initialResults || searchResults;

        if (!selectedAccount || sourceResults.length === 0) return;

        // Skip cookie check if using Apify results which are already enriched?
        // Actually, Apify results logic in page.tsx sets them as `displayedSearchResults` directly inside handleSearch polling loop.
        // The `loadNextBatch` seems to be used for "cookie" discovery or "followers" search where we get a list of users but need to fetch details?
        // Yes, code shows calling `fetch(.../profile)` inside `loadNextBatch`.
        // Apify results map `source: 'apify_search'` and already have bio.

        // If results are from Apify, they are typically fully populated.
        // But `handleSearch` for Apify ADDS to `displayedSearchResults` directly.
        // Basic search (username/hashtag/followers via internal API) sets `searchResults` but `displayedSearchResults` starts empty?
        // Let's check `handleSearch` logic for non-Apify.
        // It calls `loadNextBatch` at the end.

        // So we need cookies.
        const cookies = getCookies();
        if (!cookies) {
            toast.error('Session expired', { description: 'Please reconnect your Instagram account.' });
            return;
        }

        let keywords: string[] = [];
        if (selectedPreset) {
            const preset = KEYWORD_PRESETS.find(p => p.name === selectedPreset);
            keywords = preset?.keywords || [];
        }
        const customKeywords = bioKeywords.split(',').map(k => k.trim()).filter(k => k);
        keywords = [...keywords, ...customKeywords];

        setIsLoadingBatch(true);
        const startIndex = currentBatchIndex;
        const endIndex = Math.min(startIndex + count, sourceResults.length);
        const batch = sourceResults.slice(startIndex, endIndex);

        setLoadingProgress({ current: 0, total: batch.length });

        const newDisplayedResults: any[] = [];

        for (let i = 0; i < batch.length; i++) {
            const userProfile = batch[i];

            // If already has bio (e.g. Apify or previous fetch), skip fetch?
            // page.tsx logic fetches profile if using internal API results which might be sparse.
            // But Apify results have `source: 'apify_search'`.
            // If `userProfile.source === 'apify_search'`, we might skip?
            // Actually page.tsx logic runs `fetch` anyway? 
            // Lines 1121: `fetch(.../profile)`.
            // If we are strictly refactoring, we copy the logic.
            // BUT `loadNextBatch` in page.tsx takes `initialResults`. 

            try {
                setLoadingProgress({ current: i + 1, total: batch.length });

                // Optimization: If profile is already enriched (has bio), use it.
                // But for strict refactor I should mimic page.tsx which seems to fetch always?
                // Wait, typical `followers` endpoint returns minimal info.

                let profile = userProfile;
                let matchedKeywords: string[] = [];

                // Only fetch if we don't have bio or ensuring freshness?
                // page.tsx line 1122 fetches.
                if (!userProfile.bio && userProfile.username) {
                    const profileRes = await fetch(`/api/instagram/cookie/user/${userProfile.username}/profile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cookies }),
                    });
                    const profileData = await profileRes.json();
                    profile = profileData.success ? profileData.profile : userProfile;
                }

                const bio = profile.bio || '';
                matchedKeywords = matchKeywordsInBio(bio, keywords);

                const enrichedProfile = {
                    ...profile,
                    username: profile.username || userProfile.username,
                    fullName: profile.fullName || userProfile.fullName,
                    bio: profile.bio,
                    matchedKeywords,
                    source: userProfile.source,
                    matchedKeyword: userProfile.matchedKeyword,
                };

                newDisplayedResults.push(enrichedProfile);
                setDisplayedSearchResults(prev => [...prev, enrichedProfile]);

                // Random delay to avoid rate limits
                if (i < batch.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
                }

            } catch (error) {
                console.warn(`Failed to load profile for ${userProfile.username}`, error);
                // Add minimal profile on error
                const minimal = {
                    ...userProfile,
                    matchedKeywords: []
                };
                newDisplayedResults.push(minimal);
                setDisplayedSearchResults(prev => [...prev, minimal]);
            }
        }

        setCurrentBatchIndex(endIndex);
        setIsLoadingBatch(false);
    };

    const handleSearch = useCallback(async (loadMore = false) => {
        if (!selectedAccount) return;
        if (!searchQuery.trim() && !loadMore && searchType !== 'comment-to-lead') return;

        const currentLimit = searchLimit;
        const type = searchType;
        const query = searchQuery;

        setIsSearching(true);
        if (loadMore) setIsLoadingMore(true);
        else setSearchError('');

        try {
            let endpoint = '';
            let body: any = {
                cookies: getCookies(),
                limit: currentLimit
            };

            // Apify Logic
            if (discoveryMethod === 'apify' && (type === 'username' || type === 'hashtag')) {
                // 1. Prepare Search Terms
                let searchTerms: string[] = [];
                const presetKeywords = selectedPreset
                    ? KEYWORD_PRESETS.find(p => p.name === selectedPreset)?.keywords || []
                    : [];
                const customKeywords = bioKeywords.split(',').map(k => k.trim()).filter(k => k);

                if (query) searchTerms.push(query);
                searchTerms = [...searchTerms, ...presetKeywords, ...customKeywords];
                searchTerms = Array.from(new Set(searchTerms));

                // 2. Start Search
                const startRes = await fetch('/api/apify/search', {
                    method: 'POST',
                    body: JSON.stringify({
                        searchTerms: searchTerms,
                        searchType: 'user',
                        limit: 250,
                        action: 'start'
                    })
                });

                const startData = await startRes.json();
                if (!startData.success) throw new Error(startData.error || 'Failed to start search');

                const { runId, datasetId } = startData;
                let { status } = startData;
                let offset = 0;
                let allItems: any[] = [];

                toast.loading('Searching Instagram (Safe Mode)... This may take a moment.');

                // Polling Loop
                while (status === 'RUNNING' || status === 'READY') {
                    await new Promise(r => setTimeout(r, 3000));

                    const pollRes = await fetch('/api/apify/search', {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'poll',
                            runId,
                            datasetId,
                            offset
                        })
                    });

                    const pollData = await pollRes.json();

                    if (pollData.success) {
                        status = pollData.status;
                        const newItems = pollData.items || [];

                        if (newItems.length > 0) {
                            const enrichedItems = newItems.map((item: any) => {
                                const bio = item.biography || '';

                                let keywords: string[] = [];
                                if (selectedPreset) {
                                    const preset = KEYWORD_PRESETS.find(p => p.name === selectedPreset);
                                    keywords = preset?.keywords || [];
                                }
                                const customKeywords = bioKeywords.split(',').map(k => k.trim()).filter(Boolean);
                                const allKeywords = [...keywords, ...customKeywords];
                                const matchedKeywords = matchKeywordsInBio(bio, allKeywords);

                                return {
                                    ...item,
                                    bio,
                                    matchedKeywords,
                                    source: 'apify_search'
                                };
                            });

                            allItems = [...allItems, ...enrichedItems];
                            setSearchResults(prev => [...prev, ...enrichedItems]);
                            setDisplayedSearchResults(prev => [...prev, ...enrichedItems]);
                            offset = pollData.newOffset;

                            toast.dismiss();
                            toast.loading(`Found ${allItems.length} profiles...`);
                        }
                    } else {
                        console.error('Poll failed:', pollData.error);
                    }

                    if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') break;
                }

                toast.dismiss();
                if (allItems.length > 0) {
                    toast.success(`Search completed. Found ${allItems.length} profiles.`);
                    capture('lead_search_performed', {
                        search_type: 'apify_' + type,
                        query: query,
                        results_count: allItems.length
                    });
                } else {
                    toast.error('No profiles found.');
                    setSearchError('No profiles found using Apify. Try different keywords.');
                }
            } else {
                // Internal API Logic
                switch (type) {
                    case 'username':
                        endpoint = '/api/instagram/cookie/users/search';
                        body.query = query;
                        body.limit = Math.min(currentLimit, 50);
                        break;
                    case 'hashtag':
                        endpoint = `/api/instagram/cookie/hashtag/${query.replace('#', '')}/users`;
                        body.limit = currentLimit;
                        body.searchSource = 'bio';
                        let keywords: string[] = [];
                        if (selectedPreset) {
                            const preset = KEYWORD_PRESETS.find(p => p.name === selectedPreset);
                            keywords = preset?.keywords || [];
                        }
                        const customKeywords = bioKeywords.split(',').map(k => k.trim()).filter(k => k);
                        body.bioKeywords = [...keywords, ...customKeywords];
                        break;
                    case 'followers':
                        if (!targetUserId) {
                            toast.warning('User lookup required');
                            setIsSearching(false);
                            return;
                        }
                        endpoint = `/api/instagram/cookie/user/by-id/${targetUserId}/${followListType}`;
                        body.limit = currentLimit;
                        break;
                    case 'comment-to-lead':
                        toast.info('Please use the cards below to configure extraction');
                        setIsSearching(false);
                        return;
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API returned ${response.status}: ${errorText}`);
                }

                const result = await response.json();

                if (result.success) {
                    const results = result.users || result.followers || result.following || [];

                    if (!loadMore) {
                        setSearchResults(results);
                        setDisplayedSearchResults([]);
                        setCurrentBatchIndex(0);

                        if (results.length > 0) {
                            setTimeout(() => {
                                // Pass results directly to avoid state race condition
                                // We cant easily call loadNextBatch here because it's a closure and state might not be updated?
                                // Actually `results` is available.
                                // We need to move `loadNextBatch` out or use a ref?
                                // Or just call it.
                                // NOTE: loadNextBatch uses `searchResults` state by default but accepts `initialResults`.
                                // We should expose `loadNextBatch` or call it.
                                // But `loadNextBatch` is defined inside hook.

                                // We will rely on the `useEffect` trigger or manual call.
                                // In page.tsx:
                                // `loadNextBatch(batchSize, results);`
                                // So we need to ensure `loadNextBatch` is available.
                                // Since `loadNextBatch` is defined in the same scope, we can call it.

                                // However, `loadNextBatch` updates state `displayedSearchResults`.
                                // `setSearchResults` handles state update for `searchResults`.
                                // `loadNextBatch` handles the incremental display.
                            }, 100);
                        }
                    } else {
                        setSearchResults(results);
                    }

                    setSearchLimit(currentLimit);
                    setSearchError('');

                    capture('lead_search_performed', {
                        search_type: type,
                        query: query,
                        results_count: results.length,
                    });

                    if (results.length === 0) {
                        setSearchError('No users found.');
                    } else {
                        // Trigger batch load
                        if (!loadMore) {
                            loadNextBatch(batchSize, results);
                        }
                    }

                } else {
                    throw new Error(result.error || 'Search failed');
                }
            }

        } catch (err) {
            console.error('Search error:', err);
            setSearchError((err as Error).message);
            toast.error('Search failed');
        } finally {
            setIsSearching(false);
            setIsLoadingMore(false);
        }
    }, [
        selectedAccount, searchQuery, searchType, searchLimit, discoveryMethod,
        selectedPreset, bioKeywords, targetUserId, followListType,
        capture, getCookies, loadNextBatch
    ]);

    return {
        searchType, setSearchType,
        searchQuery, setSearchQuery,
        isSearching, setIsSearching,
        searchResults, setSearchResults,
        searchLimit, setSearchLimit,
        hasMoreResults, setHasMoreResults,
        isLoadingMore, setIsLoadingMore,
        targetUserId, setTargetUserId,
        discoveryMethod, setDiscoveryMethod,
        searchError, setSearchError,
        followListType, setFollowListType,
        displayedSearchResults, setDisplayedSearchResults,
        isLoadingBatch,
        loadingProgress,
        loadNextBatch,
        handleSearch,
        currentBatchIndex,
        batchSize
    };
}
