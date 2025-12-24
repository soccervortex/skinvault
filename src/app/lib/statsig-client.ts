/**
 * Statsig Client-Side Integration
 * For client-side feature flags and experiments
 */

'use client';

import { useEffect, useState } from 'react';
import { StatsigClient } from '@statsig/js-client';

let statsigClient: StatsigClient | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize Statsig client-side
 */
async function initializeClient(): Promise<void> {
  if (statsigClient) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const clientKey = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;
    
    if (!clientKey) {
      console.warn('Statsig client key not found. Feature flags will be disabled.');
      return;
    }

    try {
      // StatsigClient requires user parameter
      const defaultUser = { userID: 'anonymous' };
      statsigClient = new StatsigClient(clientKey, defaultUser);
      await statsigClient.initializeAsync();
      console.log('Statsig client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Statsig client:', error);
    }
  })();

  return initializationPromise;
}

/**
 * Hook to check if a feature gate is enabled
 */
export function useGate(gateName: string, userId?: string): boolean {
  const [enabled, setEnabled] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkGate() {
      await initializeClient();
      
      if (!statsigClient || !mounted) {
        return;
      }

      try {
        // Update user if provided
        if (userId && statsigClient) {
          await statsigClient.updateUserAsync({ userID: userId });
        }
        const result = statsigClient.checkGate(gateName);
        if (mounted) {
          setEnabled(result);
          setInitialized(true);
        }
      } catch (error) {
        console.error(`Error checking gate ${gateName}:`, error);
        if (mounted) {
          setEnabled(false);
          setInitialized(true);
        }
      }
    }

    checkGate();

    return () => {
      mounted = false;
    };
  }, [gateName, userId]);

  return enabled;
}

/**
 * Hook to get experiment configuration
 */
export function useExperiment(
  experimentName: string,
  userId?: string
): Record<string, any> {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function getExperiment() {
      await initializeClient();
      
      if (!statsigClient || !mounted) {
        return;
      }

      try {
        // Update user if provided
        if (userId && statsigClient) {
          await statsigClient.updateUserAsync({ userID: userId });
        }
        const experiment = statsigClient.getExperiment(experimentName);
        if (mounted) {
          setConfig(experiment.value);
          setInitialized(true);
        }
      } catch (error) {
        console.error(`Error getting experiment ${experimentName}:`, error);
        if (mounted) {
          setConfig({});
          setInitialized(true);
        }
      }
    }

    getExperiment();

    return () => {
      mounted = false;
    };
  }, [experimentName, userId]);

  return config;
}

/**
 * Log an event to Statsig
 */
export async function logEvent(
  eventName: string,
  value?: string | number,
  metadata?: Record<string, string | number | boolean>,
  userId?: string
): Promise<void> {
  await initializeClient();
  
  if (!statsigClient) {
    return;
  }

  try {
    // Update user if provided
    if (userId && statsigClient) {
      await statsigClient.updateUserAsync({ userID: userId });
    }
    // Convert metadata values to strings (Statsig requires Record<string, string>)
    const stringMetadata: Record<string, string> | undefined = metadata ? Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [k, String(v)])
    ) : undefined;
    statsigClient.logEvent(
      eventName,
      value !== undefined ? (typeof value === 'number' ? value : String(value)) : undefined,
      stringMetadata
    );
  } catch (error) {
    console.error(`Error logging event ${eventName}:`, error);
  }
}

/**
 * Initialize Statsig with user context
 */
export async function initializeWithUser(userId: string, custom?: Record<string, string | number | boolean>): Promise<void> {
  await initializeClient();
  
  if (!statsigClient) {
    return;
  }

  try {
    if (statsigClient) {
      await statsigClient.updateUserAsync({ userID: userId, custom });
    }
  } catch (error) {
    console.error('Error updating Statsig user:', error);
  }
}

