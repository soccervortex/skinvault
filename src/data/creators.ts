export type CreatorProfile = {
  slug: string;
  slugAliases?: string[];
  displayName: string;
  tagline?: string;
  avatarUrl?: string;
  tiktokUsername?: string;
  youtubeChannelId?: string;
  twitchLogin?: string;
  partnerSteamId?: string;
};

export const CREATORS: CreatorProfile[] = [
  
];

export function getCreatorBySlug(slug: string): CreatorProfile | null {
  const s = String(slug || '').toLowerCase();
  return (
    CREATORS.find((c) => {
      if (String(c.slug || '').toLowerCase() === s) return true;
      const aliases = Array.isArray(c.slugAliases) ? c.slugAliases : [];
      return aliases.some((a) => String(a || '').toLowerCase() === s);
    }) || null
  );
}
