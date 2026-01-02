import { MongoClient, Db, Collection, Document } from 'mongodb';

// Multi-cluster MongoDB configuration
const CLUSTERS = [
  'mongodb+srv://skinvaults:System1153@cluster0.5ceoi.mongodb.net/?appName=Cluster0',
  'mongodb+srv://skinvaults:System1153@cluster0.09vuhs5.mongodb.net/?appName=Cluster0',
  'mongodb+srv://skinvaults:System1153@cluster0.n03bi8z.mongodb.net/?appName=Cluster0',
  'mongodb+srv://skinvaults:System1153@cluster0.kcz6p8s.mongodb.net/?appName=Cluster0',
  'mongodb+srv://skinvaults:System1153@cluster0.edzgnci.mongodb.net/?appName=Cluster0',
];

const DB_NAME = 'skinvault';
const MAX_RETRIES = 3;
const CONNECTION_TIMEOUT = 10000; // 10 seconds

interface ClusterState {
  index: number;
  client: MongoClient | null;
  lastError: Error | null;
  lastSuccess: number;
  isHealthy: boolean;
}

// Track cluster states
const clusterStates: ClusterState[] = CLUSTERS.map((_, index) => ({
  index,
  client: null,
  lastError: null,
  lastSuccess: Date.now(),
  isHealthy: true,
}));

let currentClusterIndex = 0;
let clients: Map<number, MongoClient> = new Map();

/**
 * Test if a cluster connection is healthy
 */
async function testCluster(client: MongoClient): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    await Promise.race([
      client.db(DB_NAME).admin().ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]);
    
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get or create a MongoDB client for a specific cluster
 */
async function getClient(clusterIndex: number): Promise<MongoClient> {
  if (clients.has(clusterIndex)) {
    const existing = clients.get(clusterIndex)!;
    try {
      // Test if connection is still alive
      await existing.db(DB_NAME).admin().ping();
      return existing;
    } catch {
      // Connection is dead, clean up
      try {
        await existing.close();
      } catch {}
      clients.delete(clusterIndex);
    }
  }

  const uri = CLUSTERS[clusterIndex];
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: CONNECTION_TIMEOUT,
    connectTimeoutMS: CONNECTION_TIMEOUT,
  });

  await client.connect();
  clients.set(clusterIndex, client);
  clusterStates[clusterIndex].client = client;
  clusterStates[clusterIndex].lastSuccess = Date.now();
  clusterStates[clusterIndex].isHealthy = true;

  return client;
}

/**
 * Get the active cluster index based on health and availability
 */
function getActiveClusterIndex(): number {
  // Find the first healthy cluster
  for (let i = 0; i < clusterStates.length; i++) {
    const idx = (currentClusterIndex + i) % clusterStates.length;
    const state = clusterStates[idx];
    
    // If cluster is healthy or hasn't been tested recently, try it
    if (state.isHealthy || Date.now() - state.lastSuccess > 60000) {
      return idx;
    }
  }
  
  // Fallback to current cluster
  return currentClusterIndex;
}

/**
 * Get a connected MongoDB client with failover logic
 */
export async function getConnectedClient(): Promise<{ client: MongoClient; db: Db; clusterIndex: number }> {
  let lastError: Error | null = null;
  
  // Try clusters starting from the active one
  const startIndex = getActiveClusterIndex();
  
  for (let attempt = 0; attempt < CLUSTERS.length; attempt++) {
    const clusterIndex = (startIndex + attempt) % CLUSTERS.length;
    const state = clusterStates[clusterIndex];
    
    try {
      const client = await getClient(clusterIndex);
      
      // Test the connection
      const isHealthy = await testCluster(client);
      
      if (isHealthy) {
        currentClusterIndex = clusterIndex;
        state.isHealthy = true;
        state.lastSuccess = Date.now();
        state.lastError = null;
        
        const db = client.db(DB_NAME);
        return { client, db, clusterIndex };
      } else {
        state.isHealthy = false;
        state.lastError = new Error('Cluster health check failed');
        throw new Error('Cluster health check failed');
      }
    } catch (error: any) {
      lastError = error;
      state.isHealthy = false;
      state.lastError = error;
      
      // Clean up failed client
      if (clients.has(clusterIndex)) {
        try {
          await clients.get(clusterIndex)?.close();
        } catch {}
        clients.delete(clusterIndex);
        state.client = null;
      }
      
      // Try next cluster
      continue;
    }
  }
  
  // All clusters failed
  throw new Error(`All MongoDB clusters failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Get a collection with automatic failover
 */
export async function getCollection<T extends Document = Document>(collectionName: string): Promise<Collection<T>> {
  const { db } = await getConnectedClient();
  return db.collection<T>(collectionName);
}

/**
 * Execute an operation with automatic retry and failover
 */
export async function executeWithFailover<T>(
  operation: (db: Db) => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { db } = await getConnectedClient();
      return await operation(db);
    } catch (error: any) {
      lastError = error;
      
      // If it's a connection error, try next cluster
      if (error.message?.includes('connection') || 
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNREFUSED')) {
        // Force next cluster on next attempt
        currentClusterIndex = (currentClusterIndex + 1) % CLUSTERS.length;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw new Error(`Operation failed after ${retries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Close all connections (useful for cleanup)
 */
export async function closeAllConnections(): Promise<void> {
  for (const [index, client] of clients.entries()) {
    try {
      await client.close();
    } catch {}
    clients.delete(index);
    clusterStates[index].client = null;
  }
}

/**
 * Get current cluster status (for monitoring/debugging)
 */
export function getClusterStatus() {
  return clusterStates.map((state, index) => ({
    index,
    isHealthy: state.isHealthy,
    lastSuccess: new Date(state.lastSuccess).toISOString(),
    lastError: state.lastError?.message || null,
    isActive: index === currentClusterIndex,
  }));
}

