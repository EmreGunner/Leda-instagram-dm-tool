'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context';
import { migrateCookieStorage } from '@/lib/instagram-cookie-storage';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isOpen, openSidebar, closeSidebar } = useSidebar();

  // Migrate cookie storage on mount to ensure dual-key format
  useEffect(() => {
    try {
      migrateCookieStorage();
    } catch (e) {
      console.warn('Cookie migration failed:', e);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Backdrop overlay for mobile/tablet */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <Sidebar
        isOpen={isOpen}
        onClose={closeSidebar}
        onMenuClick={openSidebar}
      />

      <main className="pl-0 lg:pl-64">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
