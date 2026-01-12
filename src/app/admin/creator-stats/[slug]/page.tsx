import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from '@/app/components/Sidebar';
import { CreatorStatsAdminPageInner } from '../page';

export default async function AdminCreatorStatsSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
          <Sidebar />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-emerald-400" size={32} />
          </div>
        </div>
      }
    >
      <CreatorStatsAdminPageInner forcedSlug={String(slug || '').toLowerCase()} />
    </Suspense>
  );
}
