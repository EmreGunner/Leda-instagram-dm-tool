import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Maybe not used? status filter uses buttons.

interface LeadsFilterBarProps {
    leadsSearchQuery: string;
    setLeadsSearchQuery: (query: string) => void;
    sortBy: string;
    setSortBy: (sort: any) => void;
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    followerRange: number[] | null;
    setFollowerRange: (range: number[] | null) => void;
    engagementRateRange: number[] | null;
    setEngagementRateRange: (range: number[] | null) => void;
    accountAgeRange: number[] | null;
    setAccountAgeRange: (range: number[] | null) => void;
    postFrequencyRange: number[] | null;
    setPostFrequencyRange: (range: number[] | null) => void;
    minLeadScore: number | null;
    setMinLeadScore: (score: number | null) => void;
    estateCategoryFilter: string;
    setEstateCategoryFilter: (category: string) => void;
    cityFilter: string;
    setCityFilter: (city: string) => void;
    captionSearchTerm: string;
    setCaptionSearchTerm: (term: string) => void;
    uniqueCities: string[];
}

export function LeadsFilterBar({
    leadsSearchQuery,
    setLeadsSearchQuery,
    sortBy,
    setSortBy,
    statusFilter,
    setStatusFilter,
    followerRange,
    setFollowerRange,
    engagementRateRange,
    setEngagementRateRange,
    accountAgeRange,
    setAccountAgeRange,
    postFrequencyRange,
    setPostFrequencyRange,
    minLeadScore,
    setMinLeadScore,
    estateCategoryFilter,
    setEstateCategoryFilter,
    cityFilter,
    setCityFilter,
    captionSearchTerm,
    setCaptionSearchTerm,
    uniqueCities
}: LeadsFilterBarProps) {
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const handleClearFilters = () => {
        setFollowerRange(null);
        setEngagementRateRange(null);
        setAccountAgeRange(null);
        setPostFrequencyRange(null);
        setMinLeadScore(null);
        setEstateCategoryFilter('all');
        setCityFilter('all');
        setCaptionSearchTerm('');
    };

    return (
        <>
            {/* Search and Filters Row */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mt-4">
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
                <div className="mt-4 p-4 bg-background-elevated rounded-lg border border-border space-y-4">
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
                                    placeholder="Min"
                                    value={postFrequencyRange?.[0] || ""}
                                    onChange={(e) =>
                                        setPostFrequencyRange([
                                            e.target.value ? parseFloat(e.target.value) : 0,
                                            postFrequencyRange?.[1] || 100,
                                        ])
                                    }
                                    className="w-full"
                                />
                                <span className="text-foreground-muted">-</span>
                                <Input
                                    type="number"
                                    placeholder="Max"
                                    value={postFrequencyRange?.[1] || ""}
                                    onChange={(e) =>
                                        setPostFrequencyRange([
                                            postFrequencyRange?.[0] || 0,
                                            e.target.value ? parseFloat(e.target.value) : 100,
                                        ])
                                    }
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Min Lead Score */}
                        <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-2">
                                Min Lead Score
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium w-6">
                                    {minLeadScore || 0}
                                </span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={minLeadScore || 0}
                                    onChange={(e) => setMinLeadScore(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-background border border-border rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Estate Category */}
                        <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-2">
                                Estate Category
                            </label>
                            <select
                                value={estateCategoryFilter}
                                onChange={(e) => setEstateCategoryFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                                <option value="all">All Categories</option>
                                <option value="real_estate_agent">Real Estate Agent</option>
                                <option value="investor">Investor</option>
                                <option value="developer">Developer</option>
                                <option value="broker">Broker</option>
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
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                                <option value="all">All Cities</option>
                                {uniqueCities.map((city) => (
                                    <option key={city} value={city}>
                                        {city}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Caption Search */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <label className="block text-xs font-medium text-foreground-muted mb-2">
                                Search in Caption/Notes
                            </label>
                            <Input
                                placeholder="Filter by content in captions or notes..."
                                value={captionSearchTerm}
                                onChange={(e) => setCaptionSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleClearFilters}>
                            Clear Filters
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
