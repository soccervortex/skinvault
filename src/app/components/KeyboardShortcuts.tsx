"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { setupKeyboardShortcuts, KeyboardShortcut } from '@/app/utils/keyboard-shortcuts';

export default function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'k',
        ctrl: true,
        action: () => {
          // Focus search on home page
          if (pathname === '/') {
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
              searchInput.select();
            }
          }
        },
        description: 'Focus search',
      },
      {
        key: 'Escape',
        action: () => {
          // Close any open modals
          const modals = document.querySelectorAll('[role="dialog"], .modal, [data-modal]');
          modals.forEach((modal: any) => {
            const closeButton = modal.querySelector('button[aria-label*="close" i], button[aria-label*="Close"]');
            if (closeButton) {
              closeButton.click();
            }
          });
        },
        description: 'Close modals',
      },
      {
        key: '/',
        action: () => {
          // Quick search on any page
          if (pathname === '/') {
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
          } else {
            router.push('/');
            setTimeout(() => {
              const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
              if (searchInput) {
                searchInput.focus();
              }
            }, 100);
          }
        },
        description: 'Quick search',
      },
    ];

    const cleanup = setupKeyboardShortcuts(shortcuts);
    return cleanup;
  }, [router, pathname]);

  return null;
}

