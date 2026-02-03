import { useState } from 'react';
import {
    RefreshCw, Plus, X, Calendar as CalendarIcon, CheckCircle2, Search, Hash, Users, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CommentToLeadState } from '@/hooks/leads/useCommentToLead';
import { InstagramAccount } from '@/lib/types/leads';

interface CommentToLeadWizardProps {
    state: CommentToLeadState;
    selectedAccount: InstagramAccount | null;
    getCookies: () => any;
}

export function CommentToLeadWizard({ state, selectedAccount, getCookies }: CommentToLeadWizardProps) {
    const {
        ctlActiveCard, setCtlActiveCard,
        ctlUsernameInput, setCtlUsernameInput,
        ctlTargetAccounts, setCtlTargetAccounts,
        ctlIsAddingAccount,
        ctlTargetPosts, setCtlTargetPosts,
        ctlSelectedPostIds, setCtlSelectedPostIds,
        ctlIsFetchingPosts,
        ctlFetchProgress,
        ctlPostMinComments, setCtlPostMinComments,
        ctlPostDateFilter, setCtlPostDateFilter,
        ctlPasteInput, setCtlPasteInput,
        ctlIsParsingPosts, setCtlIsParsingPosts,
        ctlExpandedCaptions, setCtlExpandedCaptions,
        ctlPostCustomDateRange, setCtlPostCustomDateRange, // Need to add to hook if missing?
        ctlScrapingStatus,
        ctlDateRange, setCtlDateRange,
        ctlFilteredTargetPosts,
        handleAddTarget,
        handleFetchPosts,
        handleScrapeComments,
    } = state;

    return (
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
                                placeholder="@username or paste list (comma/newline separated)"
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
                            value={ctlPasteInput}
                            onChange={(e) => {
                                setCtlPasteInput(e.target.value);
                                setCtlActiveCard(2);
                            }}
                            rows={3}
                            className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        {ctlPasteInput.trim() && (
                            <Button
                                onClick={async () => {
                                    setCtlIsParsingPosts(true);

                                    try {
                                        // Extract shortcodes from pasted text
                                        const lines = ctlPasteInput.split('\n').filter(l => l.trim());
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
                                            } catch (error: any) {
                                                console.error('Error fetching post:', shortcode, error);
                                            }
                                        }

                                        if (fetchedPosts.length > 0) {
                                            // Merge with existing posts (avoid duplicates by ID)
                                            const existingIds = new Set(ctlTargetPosts.map(p => p.id));
                                            const newPosts = fetchedPosts.filter(p => !existingIds.has(p.id));

                                            setCtlTargetPosts(prev => [...prev, ...newPosts]);
                                            toast.success(`Added ${newPosts.length} post(s)`);
                                            setCtlPasteInput(''); // Clear textarea
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
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                        <p className="text-xs text-foreground-muted">
                                            {ctlFilteredTargetPosts.length} posts shown (of {ctlTargetPosts.length})
                                        </p>

                                        {/* Filter Toolbar */}
                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={ctlPostDateFilter}
                                                    onChange={(e) => setCtlPostDateFilter(e.target.value as any)}
                                                    className="h-8 text-xs bg-background border border-border rounded px-2"
                                                >
                                                    <option value="all">Any Date</option>
                                                    <option value="7d">Last 7 Days</option>
                                                    <option value="30d">Last 30 Days</option>
                                                    <option value="3m">Last 3 Months</option>
                                                    <option value="custom">Custom Range</option>
                                                </select>

                                                <Input
                                                    type="number"
                                                    placeholder="Min Comments"
                                                    value={ctlPostMinComments || ''}
                                                    onChange={(e) => setCtlPostMinComments(parseInt(e.target.value) || 0)}
                                                    className="h-8 w-24 text-xs"
                                                    min={0}
                                                />
                                            </div>

                                            {/* Custom Date Picker */}
                                            {ctlPostDateFilter === 'custom' && (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="secondary"
                                                            className={cn(
                                                                "w-[240px] justify-start text-left font-normal h-8 text-xs",
                                                                !state.ctlPostCustomDateRange && "text-muted-foreground"
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                                            {state.ctlPostCustomDateRange?.from ? (
                                                                state.ctlPostCustomDateRange.to ? (
                                                                    <>
                                                                        {format(state.ctlPostCustomDateRange.from, "LLL dd, y")} -{" "}
                                                                        {format(state.ctlPostCustomDateRange.to, "LLL dd, y")}
                                                                    </>
                                                                ) : (
                                                                    format(state.ctlPostCustomDateRange.from, "LLL dd, y")
                                                                )
                                                            ) : (
                                                                <span>Pick a date range</span>
                                                            )}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            initialFocus
                                                            mode="range"
                                                            defaultMonth={state.ctlPostCustomDateRange?.from}
                                                            selected={state.ctlPostCustomDateRange}
                                                            onSelect={state.setCtlPostCustomDateRange}
                                                            numberOfMonths={2}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress Indicator */}
                                    {ctlFetchProgress && (
                                        <div className="mb-2 px-1">
                                            <p className="text-xs text-primary animate-pulse">{ctlFetchProgress}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                                    {ctlFilteredTargetPosts.map((post) => {
                                        const isSelected = ctlSelectedPostIds.has(post.id);
                                        const isExpanded = ctlExpandedCaptions.has(post.id);
                                        const caption = post.caption?.text || post.caption || '';
                                        const truncatedCaption = caption.length > 60 ? caption.substring(0, 60) + '...' : caption;

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
                                                {/* Delete Button */}
                                                <button
                                                    className="absolute top-1 right-1 z-10 p-1 bg-black/50 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCtlTargetPosts(prev => prev.filter(p => p.id !== post.id));
                                                        setCtlSelectedPostIds(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete(post.id);
                                                            return newSet;
                                                        });
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>

                                                {/* Post Image */}
                                                <div className="aspect-square relative">
                                                    {(() => {
                                                        const imageUrl = post.thumbnailUrl || post.displayUrl || post.thumbnail_url || post.image_versions2?.candidates?.[0]?.url || '';
                                                        return imageUrl ? (
                                                            <img
                                                                src={imageUrl}
                                                                alt="Post"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50%"  y="50%" fill="%23999" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-background-elevated flex items-center justify-center text-foreground-muted text-xs">
                                                                No preview
                                                            </div>
                                                        );
                                                    })()}
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
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* CARD 3: Extract Leads */}
                <div className={cn(
                    "bg-background-elevated rounded-xl border-2 p-6 transition-all",
                    ctlActiveCard === 3 ? "border-accent shadow-lg shadow-accent/20" : "border-border"
                )}>
                    <h4 className="font-semibold text-foreground mb-2">3. Extract Leads</h4>
                    <p className="text-xs text-foreground-muted mb-4">Paste post link or configure extraction</p>

                    <div className="space-y-4">
                        {/* Direct Post Paste logic should be here if desired, or relying on Card 2? 
                            In page.tsx, Card 3 HAD a "Or Paste Single Post Link" input. 
                            I see I put paste logic in Card 2 in my component. 
                            Let's align with page.tsx if possible, or accept the slight change if paste is in Card 2.
                            Wait, page.tsx has paste in BOTH?
                            Line 881: "Direct Post Paste".
                            Line 558: "Post Paste Textarea" in Card 2.
                            Yes, redundant inputs. I'll stick to my component structure where Paste is in Card 2.
                            But I need Date Range and Keywords in Card 3.
                        */}

                        {/* Comment Date Filters */}
                        <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-2">Comment Date Range</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="secondary"
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-9 bg-background border-border text-xs px-3",
                                            !ctlDateRange && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                        {ctlDateRange?.from ? (
                                            ctlDateRange.to ? (
                                                <>
                                                    {format(ctlDateRange.from, "LLL dd, y")} -{" "}
                                                    {format(ctlDateRange.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(ctlDateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Pick a date range</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={ctlDateRange?.from}
                                        selected={ctlDateRange}
                                        onSelect={(range) => {
                                            setCtlDateRange(range);
                                            setCtlActiveCard(3);
                                        }}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Intent Keywords (Need state for this?) 
                            Yes, commentIntentKeywords, setCommentIntentKeywords. 
                            These are in state object.
                        */}
                        <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-2">Intent Keywords</label>
                            <Input
                                value={state.commentIntentKeywords}
                                onChange={(e) => {
                                    state.setCommentIntentKeywords(e.target.value);
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

                        {/* Extract Button moved inside space-y-4 div */}
                        <Button
                            className="w-full"
                            onClick={handleScrapeComments}
                            disabled={ctlSelectedPostIds.size === 0}
                        >
                            {ctlScrapingStatus ? ctlScrapingStatus : (ctlSelectedPostIds.size > 0 ? `Scrape Leads from ${ctlSelectedPostIds.size} Posts` : "Select Posts First")}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
