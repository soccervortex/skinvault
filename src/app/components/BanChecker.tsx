"use client";

import { useEffect, useRef } from 'react';
import { isBanned } from '@/app/utils/ban-check';

/**
 * Real-time ban checker component
 * Polls ban status every 3 seconds and immediately logs out and redirects if banned
 * Works across all tabs using storage events
 */
export default function BanChecker() {
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkBanStatus = async () => {
      // Prevent concurrent checks
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        // Test localStorage accessibility first
        const testKey = '__localStorage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);

        const stored = window.localStorage.getItem('steam_user');
        if (!stored) {
          isCheckingRef.current = false;
          return;
        }

        const user = JSON.parse(stored);
        const steamId = user?.steamId;

        if (!steamId || !/^\d{17}$/.test(steamId)) {
          isCheckingRef.current = false;
          return;
        }

        // Check ban status
        const banned = await isBanned(steamId);

        if (banned) {
          // User is banned - immediately log out and redirect
          try {
            // Clear user data
            window.localStorage.removeItem('steam_user');
            window.localStorage.removeItem('user_inventory');

            // Store banned notification for Toast component
            const bannedNotification = {
              message: 'Your account has been banned from this service. Please contact support if you believe this is an error.',
              timestamp: Date.now(),
              duration: 30000, // 30 seconds
              steamId: steamId,
              shown: false,
            };
            window.localStorage.setItem('sv_banned_notification', JSON.stringify(bannedNotification));

            // Trigger storage event for other tabs
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'steam_user',
              newValue: null,
              storageArea: localStorage,
            }));

            // Stop checking
            if (checkIntervalRef.current) {
              clearInterval(checkIntervalRef.current);
              checkIntervalRef.current = null;
            }

            // Redirect to contact page
            window.location.href = '/contact';
          } catch (error) {
            console.error('Failed to handle ban:', error);
            // Still try to redirect even if localStorage fails
            window.location.href = '/contact';
          }
        }
      } catch (error) {
        console.error('Failed to check ban status:', error);
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Check immediately on mount
    checkBanStatus();

    // Set up polling interval (check every 3 seconds)
    checkIntervalRef.current = setInterval(checkBanStatus, 3000);

    // Also listen for storage events (when user is logged out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'steam_user' && e.newValue === null) {
        // User was logged out in another tab, stop checking
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      } else if (e.key === 'steam_user' && e.newValue) {
        // User was logged in in another tab, start checking
        if (!checkIntervalRef.current) {
          checkBanStatus();
          checkIntervalRef.current = setInterval(checkBanStatus, 3000);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // This component doesn't render anything
  return null;
}

