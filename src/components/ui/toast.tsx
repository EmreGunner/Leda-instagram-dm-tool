'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'bg-background-secondary border border-border text-foreground',
          title: 'text-foreground font-semibold',
          description: 'text-foreground-muted',
          actionButton: 'bg-accent text-white',
          cancelButton: 'bg-background-elevated text-foreground',
          success: 'bg-success/10 border-success/20 text-success',
          error: 'bg-error/10 border-error/20 text-error',
          warning: 'bg-warning/10 border-warning/20 text-warning',
          info: 'bg-accent/10 border-accent/20 text-accent',
        },
      }}
    />
  );
}

