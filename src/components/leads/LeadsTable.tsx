import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { MobileLeadCard } from "@/components/leads/mobile-lead-card";
import { cn } from '@/lib/utils';
import { Lead, statusColors } from '@/lib/types/leads';
import {
    RefreshCw, Send, Plus, Users, CheckCircle2, Eye, Instagram, X
} from 'lucide-react';

interface LeadsTableProps {
    isLoading: boolean;
    processedLeads: Lead[];
    displayedLeads: Lead[];
    selectedLeads: Set<string>;
    toggleLeadSelection: (id: string) => void;
    toggleSelectAll: () => void;
    hasMoreLeads: boolean;
    handleLoadMore: () => void;
    leadsPerBatch: number;
    handleViewProfile: (lead: Lead) => void;
    setProfileModalUsername: (username: string) => void;
    setShowLeadProfileModal: (show: boolean) => void;
}

export function LeadsTable({
    isLoading,
    processedLeads,
    displayedLeads,
    selectedLeads,
    toggleLeadSelection,
    toggleSelectAll,
    hasMoreLeads,
    handleLoadMore,
    leadsPerBatch,
    handleViewProfile,
    setProfileModalUsername,
    setShowLeadProfileModal
}: LeadsTableProps) {
    return (
        <>
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
                                                selectedLeads.size === processedLeads.length &&
                                                processedLeads.length > 0
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
        </>
    );
}
