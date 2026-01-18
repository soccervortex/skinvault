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

const generateRandomReelItems = (): RewardTier[] => {
  const items: RewardTier[] = [];
  for (let i = 0; i < 50; i++) {
    const idx = Math.floor(Math.random() * REWARD_TIERS.length);
    items.push(REWARD_TIERS[idx]);
  }
  return items;
};

const SpinWheel = ({
  reward,
  onSpinComplete,
  onClose,
}: {
  reward: number;
  onSpinComplete: (reward: number) => void;
  onClose?: () => void;
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
        controlsRef.current.set({ x: 0 });
        await controlsRef.current.start({
          x: translateX,
          transition: { duration: 5, ease: 'easeOut' },
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
  }, [isSpinning, readyToAnimate, reward, translateX]);

  return (
    <div
      className="fixed inset-0 z-[10002] bg-black/80 backdrop-blur-sm flex items-center justify-center overscroll-contain p-0 md:p-6"
      onClick={() => onCloseRef.current?.()}
    >
      <div
        className="w-full h-dvh md:h-auto md:max-h-[92dvh] md:max-w-5xl overflow-y-auto custom-scrollbar bg-[#0f111a] md:bg-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-3">
          <button
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
            onClick={() => onCloseRef.current?.()}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="w-full bg-[#0f111a] border border-white/10 rounded-none md:rounded-[2rem] p-4 md:p-6">
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
        </div>
      </div>
    </div>
  );
};

export default SpinWheel;
