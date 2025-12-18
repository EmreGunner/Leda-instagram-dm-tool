'use client';

import { PostHogProvider } from '@/lib/posthog';
import { Toaster } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      {children}
      <Toaster />
    </PostHogProvider>
  );
}

