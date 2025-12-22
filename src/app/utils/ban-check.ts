// Utility to check if a Steam ID is banned

export async function isBanned(steamId: string): Promise<boolean> {
  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return false;
  }

  try {
    const response = await fetch(`/api/admin/ban?steamId=${steamId}`);
    if (response.ok) {
      const data = await response.json();
      return data.banned === true;
    }
  } catch (error) {
    console.error('Failed to check ban status:', error);
  }
  
  return false;
}

