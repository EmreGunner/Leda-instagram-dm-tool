import { useState, useCallback } from 'react';
import { Lead } from '@/lib/types/leads';

export function useLeadSelection(leads: Lead[]) {
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

    // Toggle lead selection
    const toggleLeadSelection = useCallback((leadId: string) => {
        setSelectedLeads(prev => {
            const newSelected = new Set(prev);
            if (newSelected.has(leadId)) {
                newSelected.delete(leadId);
            } else {
                newSelected.add(leadId);
            }
            return newSelected;
        });
    }, []);

    // Select all
    const toggleSelectAll = useCallback(() => {
        setSelectedLeads(prev => {
            if (prev.size === leads.length) {
                return new Set();
            } else {
                return new Set(leads.map(l => l.id));
            }
        });
    }, [leads]);

    return {
        selectedLeads,
        setSelectedLeads,
        toggleLeadSelection,
        toggleSelectAll
    };
}
