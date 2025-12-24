/**
 * Statsig Provider Component
 * Wraps the app to initialize Statsig client-side
 */

'use client';

import { useEffect } from 'react';
import { initializeWithUser } from '@/app/lib/statsig-client';

interface StatsigProviderProps {
  children: React.ReactNode;
  userId?: string;
  userCustom?: Record<string, string | number | boolean>;
}

export default function StatsigProvider({ 
  children, 
  userId, 
  userCustom 
}: StatsigProviderProps) {
  useEffect(() => {
    if (userId) {
      initializeWithUser(userId, userCustom);
    }
  }, [userId, userCustom]);

  return <>{children}</>;
}

