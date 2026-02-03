import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCookies as getCookiesFromStorage } from '@/lib/instagram-cookie-storage';
import { toast } from 'sonner';
import { InstagramAccount } from '@/lib/types/leads';

export function useInstagramAccounts() {
    const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<InstagramAccount | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAccounts = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('instagram_accounts')
                .select('id, ig_user_id, ig_username')
                .eq('user_id', user.id);

            if (error) throw error;

            if (data) {
                const mappedAccounts: InstagramAccount[] = data.map(acc => ({
                    id: acc.id,
                    igUserId: acc.ig_user_id,
                    igUsername: acc.ig_username
                }));
                setAccounts(mappedAccounts);
                if (mappedAccounts.length > 0) {
                    setSelectedAccount(mappedAccounts[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            toast.error('Failed to load Instagram accounts');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getCookies = useCallback(async () => {
        if (!selectedAccount) return null;
        return await getCookiesFromStorage(selectedAccount.igUsername);
    }, [selectedAccount]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    return {
        accounts,
        selectedAccount,
        setSelectedAccount,
        isLoading,
        fetchAccounts,
        getCookies
    };
}
