import { redirect } from 'next/navigation';

export default async function AdminCreatorStatsSlugPage(
  { params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Record<string, string | string[] | undefined> }
) {
  const { slug } = await params;
  const sp = (searchParams || {}) as any;

  const rangeDaysRaw = Array.isArray(sp?.rangeDays) ? sp.rangeDays[0] : sp?.rangeDays;
  const metricRaw = Array.isArray(sp?.metric) ? sp.metric[0] : sp?.metric;

  const qs = new URLSearchParams();
  qs.set('slug', String(slug || '').toLowerCase());
  if (rangeDaysRaw) qs.set('rangeDays', String(rangeDaysRaw));
  if (metricRaw) qs.set('metric', String(metricRaw));

  redirect(`/admin/creator-stats?${qs.toString()}`);
}
