export const WEAR_FLOAT_RANGES: Record<string, { min: number; max: number }> = {
  'Factory New': { min: 0.0, max: 0.07 },
  'Minimal Wear': { min: 0.07, max: 0.15 },
  'Field-Tested': { min: 0.15, max: 0.37 },
  'Well-Worn': { min: 0.37, max: 0.45 },
  'Battle-Scarred': { min: 0.45, max: 1.0 },
};

export function getWearNameFromSkin(skinName: string): string | null {
  const match = skinName.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
}

export function getWearFloatRange(wearName: string): { min: number; max: number } | null {
  return WEAR_FLOAT_RANGES[wearName] || null;
}
