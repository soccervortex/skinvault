'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const REWARDS = [10, 25, 50, 100, 500, 1000];

// Generate a list of items for the spinner reel
const generateReelItems = (finalReward: number) => {
  let items = [];
  for (let i = 0; i < 50; i++) {
    items.push(REWARDS[Math.floor(Math.random() * REWARDS.length)]);
  }
  // Ensure the final reward is in the right place
  items[45] = finalReward;
  return items;
};

const SpinWheel = ({ onSpinComplete }: { onSpinComplete: (reward: number) => void }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<number[]>([]);
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
      <div className="w-full max-w-4xl bg-gray-900 border border-yellow-500 rounded-lg p-4">
        <div className="relative h-40 w-full overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-44 bg-yellow-500 z-20"></div>
          <AnimatePresence>
            {isSpinning && reelItems.length > 0 && (
              <motion.div
                className="flex h-full items-center"
                initial={{ x: 0 }}
                animate={{ x: -180 * 45 + 90 }} // Center the 45th item
                transition={{ duration: 5, ease: 'easeOut' }}
                onAnimationComplete={handleAnimationComplete}
              >
                {reelItems.map((reward, i) => (
                  <div key={i} className="flex-shrink-0 w-44 h-36 flex items-center justify-center text-white text-2xl font-bold bg-gray-800 border-2 border-gray-700 rounded-lg mx-1">
                    {reward}
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
