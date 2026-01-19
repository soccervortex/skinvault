'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';

const REWARD_TIERS = [
  { reward: 10, label: 'Consumer Grade', color: '#b0c3d9' },
  { reward: 25, label: 'Industrial Grade', color: '#5e98d9' },
  { reward: 50, label: 'Mil-Spec', color: '#4b69ff' },
  { reward: 100, label: 'Restricted', color: '#8847ff' },
  { reward: 500, label: 'Classified', color: '#d32ce6' },
  { reward: 1000, label: 'Covert', color: '#eb4b4b' },
  { reward: 2000, label: 'Extraordinary', color: '#eb4b4b' },
  { reward: 5000, label: 'Extraordinary', color: '#eb4b4b' },
  { reward: 10000, label: 'Contraband', color: '#ffd700' },
  { reward: 30000, label: 'Contraband', color: '#ffd700' },
] as const;

type RewardTier = (typeof REWARD_TIERS)[number];

type SpinWheelHistoryItem = {
  reward: number;
  createdAt: string | null;
  role: string | null;
};

type SpinWheelHistorySummary = {
  totalSpins: number;
  totalCredits: number;
  bestReward: number;
};

function getTierByReward(reward: number): RewardTier {
  const found = REWARD_TIERS.find((t) => t.reward === reward);
  return found || REWARD_TIERS[0];
}

// Generate a list of items for the spinner reel
const generateReelItems = (finalReward: number): RewardTier[] => {
  const items: RewardTier[] = [];
  for (let i = 0; i < 50; i++) {
    const idx = Math.floor(Math.random() * REWARD_TIERS.length);
    items.push(REWARD_TIERS[idx]);
  }
  items[45] = getTierByReward(finalReward);
  return items;
};

const SpinWheel = ({
  reward,
  onSpinComplete,
  onClose,
  durationSeconds,
  historyItems,
  historySummary,
  historyLoading,
}: {
  reward: number;
  onSpinComplete: (reward: number) => void;
  onClose?: () => void;
  durationSeconds?: number;
  historyItems?: SpinWheelHistoryItem[];
  historySummary?: SpinWheelHistorySummary | null;
  historyLoading?: boolean;
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<RewardTier[]>([]);
  const [translateX, setTranslateX] = useState<number>(0);
  const [readyToAnimate, setReadyToAnimate] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const didComputeTargetRef = useRef(false);
  const didStartAnimationRef = useRef(false);
  const controls = useAnimationControls();
  const controlsRef = useRef(controls);
  const onSpinCompleteRef = useRef(onSpinComplete);
  const onCloseRef = useRef(onClose);

  const targetIndex = 45;

  useEffect(() => {
    onSpinCompleteRef.current = onSpinComplete;
  }, [onSpinComplete]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const r = Number(reward);
    if (!Number.isFinite(r)) {
      onSpinCompleteRef.current(0);
      return;
    }

    setIsSpinning(true);
    setReadyToAnimate(false);
    didComputeTargetRef.current = false;
    didStartAnimationRef.current = false;
    setTranslateX(0);
    controlsRef.current.set({ x: 0 });
    setReelItems(generateReelItems(r));
  }, [reward]);

  useEffect(() => {
    if (didComputeTargetRef.current) return;
    if (reelItems.length === 0) return;

    let cancelled = false;

    const compute = async () => {
      try {
        const fontsReady = (document as any).fonts?.ready;
        if (fontsReady) await fontsReady;
      } catch {
      }

      for (let i = 0; i < 30; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        if (cancelled) return;
        if (didComputeTargetRef.current) return;

        const container = containerRef.current;
        const target = targetRef.current;
        if (!container || !target) continue;

        const containerWidth = container.clientWidth;
        const targetWidth = target.offsetWidth;
        if (!(containerWidth > 0) || !(targetWidth > 0)) continue;

        const containerCenter = containerWidth / 2;
        const targetCenter = target.offsetLeft + targetWidth / 2;
        const delta = targetCenter - containerCenter;
        const nextTranslate = -delta;

        setTranslateX(nextTranslate);
        setReadyToAnimate(true);
        didComputeTargetRef.current = true;
        return;
      }
    };

    void compute();

    return () => {
      cancelled = true;
    };
  }, [reelItems]);

  useEffect(() => {
    if (!readyToAnimate) return;
    if (didStartAnimationRef.current) return;
    if (!isSpinning) return;

    let cancelled = false;
    didStartAnimationRef.current = true;

    const r = Number(reward);
    if (!Number.isFinite(r)) {
      onSpinCompleteRef.current(0);
      return;
    }

    const run = async () => {
      try {
        const dur = Number(durationSeconds);
        const duration = Number.isFinite(dur) && dur > 0.1 && dur < 30 ? dur : 5;
        controlsRef.current.set({ x: 0 });
        await controlsRef.current.start({
          x: translateX,
          transition: { duration, ease: 'easeOut' },
        });
        if (cancelled) return;
        onSpinCompleteRef.current(r);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        onSpinCompleteRef.current(0);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [durationSeconds, isSpinning, readyToAnimate, reward, translateX]);

  return (
    <div
      className="fixed inset-0 z-[10004] bg-[#08090d] flex items-center justify-center overscroll-contain p-4 md:p-8"
      onClick={() => onCloseRef.current?.()}
    >
      <div
        className="w-full h-full max-w-5xl max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-4rem)] bg-[#0f111a] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 md:px-8 py-4 border-b border-white/10 bg-[#0f111a]">
          <div className="flex items-center justify-end">
            <button
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
              onClick={() => onCloseRef.current?.()}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 md:px-8 py-5">
          <div className="w-full bg-[#0f111a] border border-white/10 rounded-[2rem] p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-black">
                Opening...
              </div>
            </div>
            <div ref={containerRef} className="relative h-36 md:h-40 w-full overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-40 md:h-44 bg-yellow-500 z-20 rounded-full"></div>
              <AnimatePresence>
                {isSpinning && reelItems.length > 0 && (
                  <motion.div
                    className="flex h-full items-center gap-2"
                    initial={{ x: 0 }}
                    animate={controls}
                  >
                    {reelItems.map((tier, i) => (
                      <div
                        key={i}
                        ref={i === targetIndex ? targetRef : undefined}
                        className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px] h-32 md:h-36 rounded-2xl border border-white/10 bg-black/30 relative overflow-hidden"
                      >
                        <div
                          className="absolute inset-0 opacity-20"
                          style={{ background: `radial-gradient(circle at 30% 20%, ${tier.color}, transparent 60%)` }}
                        />
                        <div className="relative h-full w-full flex flex-col justify-center px-4">
                          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: tier.color }}>
                            {tier.label}
                          </div>
                          <div className="mt-2 text-white text-2xl md:text-3xl font-black italic tracking-tighter">
                            {tier.reward}
                            <span className="text-[12px] text-gray-400 ml-1">CR</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {(historySummary || (historyItems && historyItems.length > 0) || historyLoading) && (
              <div className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Best win (30d)</div>
                    <div className="mt-2 text-2xl font-black italic tracking-tighter text-yellow-300">
                      {Number(historySummary?.bestReward || 0).toLocaleString()}
                      <span className="text-[12px] text-gray-400 ml-1">CR</span>
                    </div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Spins (30d)</div>
                    <div className="mt-2 text-2xl font-black italic tracking-tighter text-white">
                      {Number(historySummary?.totalSpins || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Credits won (30d)</div>
                    <div className="mt-2 text-2xl font-black italic tracking-tighter text-emerald-300">
                      {Number(historySummary?.totalCredits || 0).toLocaleString()}
                      <span className="text-[12px] text-gray-400 ml-1">CR</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-black/30 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Latest rewards</div>
                    {historyLoading ? (
                      <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-transparent animate-spin" />
                    ) : null}
                  </div>
                  {!historyItems || historyItems.length === 0 ? (
                    <div className="px-4 py-4 text-[11px] text-gray-500">No spins yet.</div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {historyItems.slice(0, 5).map((r, idx) => {
                        const ts = r.createdAt ? new Date(r.createdAt) : null;
                        const timeLabel = ts && !isNaN(ts.getTime()) ? ts.toLocaleString() : '—';
                        return (
                          <div key={`${r.createdAt ?? 'na'}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-[10px] font-black uppercase tracking-widest text-gray-200">{timeLabel}</div>
                              <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">{String(r.role || 'user')}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Won</div>
                              <div className="text-[13px] font-black italic tracking-tighter text-emerald-300">
                                {Number(r.reward || 0).toLocaleString()} CR
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpinWheel;
