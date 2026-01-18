'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  onSpinComplete,
  onClose,
}: {
  onSpinComplete: (reward: number) => void;
  onClose?: () => void;
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<RewardTier[]>([]);
  const [finalReward, setFinalReward] = useState<number | null>(null);
  const [translateX, setTranslateX] = useState<number>(0);
  const [readyToAnimate, setReadyToAnimate] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const didComputeTargetRef = useRef(false);

  const targetIndex = 45;

  useEffect(() => {
    // Trigger the spin on mount
    const startSpin = async () => {
      setIsSpinning(true);
      setReadyToAnimate(false);
      didComputeTargetRef.current = false;
      setTranslateX(0);
      setReelItems(generateRandomReelItems());
      try {
        const response = await fetch('/api/spins', { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
          setFinalReward(data.reward);
          setReelItems((prev) => {
            const next = Array.isArray(prev) && prev.length === 50 ? [...prev] : generateRandomReelItems();
            next[targetIndex] = getTierByReward(data.reward);
            return next;
          });
        } else {
          throw new Error(data.error || 'Failed to spin');
        }
      } catch (error) {
        console.error(error);
        onSpinComplete(0); // Indicate error
      }
    };
    startSpin();
  }, [onSpinComplete]);

  useEffect(() => {
    if (didComputeTargetRef.current) return;
    if (!containerRef.current || !targetRef.current) return;
    if (reelItems.length === 0) return;
    if (finalReward === null) return;

    // Wait a frame to ensure layout is fully calculated (fonts, responsive widths, etc.)
    const raf = requestAnimationFrame(() => {
      if (didComputeTargetRef.current) return;
      if (!containerRef.current || !targetRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const targetRect = targetRef.current.getBoundingClientRect();

      // Compute the winning card's center relative to the container's left edge.
      const targetCenter = (targetRect.left - containerRect.left) + targetRect.width / 2;
      const containerCenter = containerRect.width / 2;
      const delta = targetCenter - containerCenter;

      // Move reel left by delta so the target center aligns with container center.
      setTranslateX(-delta);
      setReadyToAnimate(true);
      didComputeTargetRef.current = true;
    });

    return () => cancelAnimationFrame(raf);
  }, [reelItems.length, finalReward]);

  const handleAnimationComplete = () => {
    if (finalReward !== null) {
      onSpinComplete(finalReward);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-3">
          <button
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
            onClick={() => onClose?.()}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="w-full bg-[#0f111a] border border-white/10 rounded-[2rem] p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-black">
              {finalReward !== null ? `Winning: ${finalReward} CR` : 'Opening...'}
            </div>
          </div>
          <div ref={containerRef} className="relative h-36 md:h-40 w-full overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-40 md:h-44 bg-yellow-500 z-20 rounded-full"></div>
            <AnimatePresence>
              {isSpinning && reelItems.length > 0 && (
                <motion.div
                  className="flex h-full items-center gap-2"
                  initial={{ x: 0 }}
                  animate={{ x: readyToAnimate ? translateX : 0 }}
                  transition={readyToAnimate ? { duration: 5, ease: 'easeOut' } : { duration: 0 }}
                  onAnimationComplete={handleAnimationComplete}
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
