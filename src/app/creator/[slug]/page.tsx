import CreatorPageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function CreatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CreatorPageClient slug={slug} />;
}
