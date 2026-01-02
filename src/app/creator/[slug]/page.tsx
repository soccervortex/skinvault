import CreatorPageClient from './page-client';

export const dynamic = 'force-dynamic';

export default function CreatorPage({ params }: { params: { slug: string } }) {
  return <CreatorPageClient slug={params.slug} />;
}
