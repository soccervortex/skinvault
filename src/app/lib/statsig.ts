/**
 * Statsig Integration
 * Feature flags, A/B testing, and experimentation
 * 
 * Server-side Statsig client for feature flags and experiments
 */

import Statsig from 'statsig-node';

let initialized = false;

/**
 * Initialize Statsig server-side client
 * Should be called once at application startup
 */
export async function initializeStatsig() {
  if (initialized) {
    return Statsig;
  }

  const serverSecretKey = process.env.STATSIG_SERVER_SECRET_KEY;
  
  if (!serverSecretKey) {
    console.warn('Statsig server secret key not found. Feature flags will be disabled.');
    return null;
  }

  try {
    await Statsig.initialize(serverSecretKey, {
      localMode: process.env.NODE_ENV === 'development',
    });
    
    initialized = true;
    console.log('Statsig initialized successfully');
    return Statsig;
  } catch (error) {
    console.error('Failed to initialize Statsig:', error);
    return null;
  }
}

/**
 * Check if a feature gate is enabled for a user
 */
export async function checkGate(
  user: { userID: string; custom?: Record<string, string | number | boolean> },
  gateName: string
): Promise<boolean> {
  await initializeStatsig();
  if (!initialized) {
    return false; // Default to false if Statsig not initialized
  }

  try {
    const result = Statsig.checkGate(user, gateName);
    return result;
  } catch (error) {
    console.error(`Error checking gate ${gateName}:`, error);
    return false;
  }
}

/**
 * Get experiment configuration for a user
 */
export async function getExperiment(
  user: { userID: string; custom?: Record<string, string | number | boolean> },
  experimentName: string
): Promise<Record<string, any>> {
  await initializeStatsig();
  if (!initialized) {
    return {}; // Return empty config if Statsig not initialized
  }

  try {
    const config = Statsig.getExperiment(user, experimentName);
    return config.value as Record<string, any>;
  } catch (error) {
    console.error(`Error getting experiment ${experimentName}:`, error);
    return {};
  }
}

/**
 * Get dynamic config for a user
 */
export async function getConfig(
  user: { userID: string; custom?: Record<string, string | number | boolean> },
  configName: string
): Promise<Record<string, any>> {
  await initializeStatsig();
  if (!initialized) {
    return {}; // Return empty config if Statsig not initialized
  }

  try {
    const config = Statsig.getConfig(user, configName);
    return config.value as Record<string, any>;
  } catch (error) {
    console.error(`Error getting config ${configName}:`, error);
    return {};
  }
}

/**
 * Log an event to Statsig for analytics
 */
export async function logEvent(
  user: { userID: string; custom?: Record<string, string | number | boolean> },
  eventName: string,
  value?: string | number,
  metadata?: Record<string, string | number | boolean>
): Promise<void> {
  await initializeStatsig();
  if (!initialized) {
    return; // Silently fail if Statsig not initialized
  }

  try {
    // Convert metadata to Record<string, unknown> as required by Statsig
    const statsigMetadata = metadata ? Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [k, v as unknown])
    ) : undefined;
    Statsig.logEvent(user, eventName, value, statsigMetadata);
  } catch (error) {
    console.error(`Error logging event ${eventName}:`, error);
  }
}

/**
 * Shutdown Statsig client (call on app shutdown)
 */
export async function shutdownStatsig(): Promise<void> {
  if (initialized) {
    await Statsig.shutdownAsync();
    initialized = false;
  }
}

