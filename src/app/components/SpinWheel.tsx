'use client';

import React, { useState, useEffect } from 'react';
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

const SpinWheel = ({ onSpinComplete }: { onSpinComplete: (reward: number) => void }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<RewardTier[]>([]);
  const [finalReward, setFinalReward] = useState<number | null>(null);

  useEffect(() => {
    // Trigger the spin on mount
    const startSpin = async () => {
      setIsSpinning(true);
      try {
        const response = await fetch('/api/spins', { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
          setFinalReward(data.reward);
          setReelItems(generateReelItems(data.reward));
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

  const handleAnimationComplete = () => {
    if (finalReward !== null) {
      onSpinComplete(finalReward);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="w-full max-w-5xl bg-[#0f111a] border border-white/10 rounded-[2rem] p-4 md:p-6">
        <div className="relative h-40 w-full overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-44 bg-yellow-500 z-20 rounded-full"></div>
          <AnimatePresence>
            {isSpinning && reelItems.length > 0 && (
              <motion.div
                className="flex h-full items-center"
                initial={{ x: 0 }}
                animate={{ x: -180 * 45 + 90 }} // Center the 45th item
                transition={{ duration: 5, ease: 'easeOut' }}
                onAnimationComplete={handleAnimationComplete}
              >
                {reelItems.map((tier, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-44 h-36 rounded-2xl mx-1 border border-white/10 bg-black/30 relative overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{ background: `radial-gradient(circle at 30% 20%, ${tier.color}, transparent 60%)` }}
                    />
                    <div className="relative h-full w-full flex flex-col justify-center px-4">
                      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: tier.color }}>
                        {tier.label}
                      </div>
                      <div className="mt-2 text-white text-3xl font-black italic tracking-tighter">
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
  );
};

export default SpinWheel;
