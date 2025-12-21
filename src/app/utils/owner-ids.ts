/**
 * List of owner Steam IDs who have admin access
 */
export const OWNER_STEAM_IDS = [
  '76561199235618867', // Original owner
  '76561199052427203', // Co-owner
] as const;

/**
 * Check if a Steam ID is an owner
 */
export function isOwner(steamId: string | null | undefined): boolean {
  if (!steamId) return false;
  return OWNER_STEAM_IDS.includes(steamId as any);
}

