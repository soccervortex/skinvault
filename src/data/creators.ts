export type CreatorProfile = {
  slug: string;
  displayName: string;
  tagline?: string;
  avatarUrl?: string;
  tiktokUsername?: string;
  youtubeChannelId?: string;
  twitchLogin?: string;
};

export const CREATORS: CreatorProfile[] = [
  {
    slug: 'stins',
    displayName: 'Stins',
    tagline: 'Featured Creator',
    avatarUrl: 'https://i.imgur.com/9B9QZQv.png',
    tiktokUsername: 'stinssssss',
    youtubeChannelId: '',
    twitchLogin: '',
  },
];

export function getCreatorBySlug(slug: string): CreatorProfile | null {
  const s = String(slug || '').toLowerCase();
  return CREATORS.find((c) => c.slug.toLowerCase() === s) || null;
}
