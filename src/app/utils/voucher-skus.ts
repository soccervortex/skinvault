export type VoucherSkuId =
  | 'starter_1m'
  | 'value_1m'
  | 'mega_1m'
  | 'giant_3m'
  | 'whale_3m'
  | 'titan_6m'
  | 'legend_6m';

export type VoucherSku = {
  id: VoucherSkuId;
  label: string;
  credits: number;
  proMonths: number;
};

export const VOUCHER_SKUS: Record<VoucherSkuId, VoucherSku> = {
  starter_1m: { id: 'starter_1m', label: 'Starter Bundle', credits: 500, proMonths: 1 },
  value_1m: { id: 'value_1m', label: 'Value Bundle', credits: 1500, proMonths: 1 },
  mega_1m: { id: 'mega_1m', label: 'Mega Bundle', credits: 4000, proMonths: 1 },
  giant_3m: { id: 'giant_3m', label: 'Giant Bundle', credits: 10000, proMonths: 3 },
  whale_3m: { id: 'whale_3m', label: 'Whale Bundle', credits: 30000, proMonths: 3 },
  titan_6m: { id: 'titan_6m', label: 'Titan Bundle', credits: 50000, proMonths: 6 },
  legend_6m: { id: 'legend_6m', label: 'Legend Bundle', credits: 75000, proMonths: 6 },
};

export function resolveVoucherSku(raw: unknown): VoucherSku | null {
  const id = String(raw || '').trim() as VoucherSkuId;
  return (VOUCHER_SKUS as any)[id] || null;
}
