"use client";

import { useState, useEffect } from 'react';
import { Gift, X, Sparkles } from 'lucide-react';
import { saveReward, type Reward } from '@/app/utils/theme-rewards';
import { ThemeType } from '@/app/utils/theme-storage';

interface ThemeGiftProps {
  theme: ThemeType;
  steamId?: string | null;
}

// Theme-specific styling
const THEME_STYLES: Record<ThemeType, {
  gradient: string;
  giftColor: string;
  ribbonColor: string;
}> = {
  christmas: {
    gradient: 'from-red-600 via-red-500 to-green-600',
    giftColor: 'bg-gradient-to-br from-red-500 to-green-500',
    ribbonColor: 'bg-yellow-300',
  },
  halloween: {
    gradient: 'from-orange-600 via-purple-600 to-black',
    giftColor: 'bg-gradient-to-br from-orange-500 to-purple-800',
    ribbonColor: 'bg-gray-300',
  },
  easter: {
    gradient: 'from-pink-400 via-yellow-300 to-green-400',
    giftColor: 'bg-gradient-to-br from-pink-300 to-yellow-200',
    ribbonColor: 'bg-blue-300',
  },
  sinterklaas: {
    gradient: 'from-red-600 via-red-500 to-white',
    giftColor: 'bg-gradient-to-br from-red-500 to-white',
    ribbonColor: 'bg-yellow-300',
  },
  newyear: {
    gradient: 'from-blue-600 via-purple-600 to-pink-600',
    giftColor: 'bg-gradient-to-br from-blue-500 to-purple-500',
    ribbonColor: 'bg-yellow-300',
  },
  oldyear: {
    gradient: 'from-gray-700 via-blue-600 to-purple-700',
    giftColor: 'bg-gradient-to-br from-gray-600 to-blue-500',
    ribbonColor: 'bg-yellow-400',
  },
};

export default function ThemeGift({ theme, steamId }: ThemeGiftProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reward, setReward] = useState<Reward | null>(null);

  const themeStyles = THEME_STYLES[theme];

  useEffect(() => {
    const checkClaimStatus = async () => {
      if (!steamId) {
        // For non-logged-in users, check localStorage as fallback
        if (typeof window !== 'undefined') {
          // Use 2025 for current year (Christmas, Old Year), 2026 for next year events
          const year = theme === 'christmas' || theme === 'oldyear' ? '2025' : '2026';
          setHasClaimed(localStorage.getItem(`sv_${theme}_gift_claimed_${year}`) === 'true');
        }
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(`/api/gift/claim?steamId=${steamId}&theme=${theme}`);
        if (response.ok) {
          const data = await response.json();
          setHasClaimed(data.claimed || false);
        }
      } catch (error) {
        console.error('Failed to check gift claim status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkClaimStatus();
  }, [steamId, theme]);

  const handleGiftClick = async () => {
    if (hasClaimed || isOpening || checking || !steamId) {
      // For non-logged-in users, show message
      if (!steamId) {
        alert('Log in with Steam to open your gift!');
      }
      return;
    }
    
    setIsOpening(true);
    
    // Animate box opening
    setTimeout(async () => {
      setIsOpening(false);
      setIsOpen(true);
      
      // Save to database (server will generate reward based on Pro status and theme)
      try {
        const response = await fetch('/api/gift/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steamId, theme }),
        });

        if (response.ok) {
          const data = await response.json();
          const randomReward = data.reward;
          setReward(randomReward);
          
          // Also save to localStorage as backup
          saveReward(randomReward, theme);
          setShowModal(true);
          setHasClaimed(true);
        } else {
          const data = await response.json();
          if (data.alreadyClaimed) {
            alert('You have already opened this gift!');
            setHasClaimed(true);
          } else {
            alert('Something went wrong. Please try again.');
            setIsOpening(false);
            setIsOpen(false);
          }
        }
      } catch (error) {
        console.error('Failed to claim gift:', error);
        alert('Something went wrong. Please try again.');
        setIsOpening(false);
        setIsOpen(false);
      }
    }, 1500); // Opening animation duration
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  if (checking) return null; // Don't show while checking
  if (hasClaimed && !showModal) return null;

  return (
    <>
      {/* 3D Gift Box */}
      {!isOpen && (
        <div
          className="fixed bottom-6 right-6 z-[10000] cursor-pointer transform transition-all hover:scale-110"
          onClick={handleGiftClick}
          style={{ animation: hasClaimed ? 'none' : 'bounce-gift 2s ease-in-out infinite' }}
        >
          <div className="relative w-20 h-20 md:w-24 md:h-24 perspective-1000">
            {/* Gift Box */}
            <div className={`absolute inset-0 ${themeStyles.giftColor} rounded-lg shadow-2xl transform-gpu`}
              style={{
                transform: isOpening 
                  ? 'rotateY(180deg) translateZ(20px)' 
                  : 'rotateY(0deg) translateZ(0px)',
                transition: isOpening ? 'transform 1.5s ease-in-out' : 'none',
              }}
            >
              {/* Ribbon Horizontal */}
              <div className={`absolute top-1/2 left-0 right-0 h-4 ${themeStyles.ribbonColor} opacity-90 transform -translate-y-1/2`}></div>
              {/* Ribbon Vertical */}
              <div className={`absolute left-1/2 top-0 bottom-0 w-4 ${themeStyles.ribbonColor} opacity-90 transform -translate-x-1/2`}></div>
              {/* Ribbon Bow */}
              <div className={`absolute top-1/2 left-1/2 w-8 h-8 ${themeStyles.ribbonColor} rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-95`}></div>
            </div>
            
            {/* Sparkle effects */}
            <div className="absolute -top-2 -right-2 text-yellow-300 text-2xl animate-pulse">✨</div>
            <div className="absolute -bottom-1 -left-1 text-yellow-200 text-xl animate-pulse delay-300">⭐</div>
          </div>
        </div>
      )}

      {/* Reward Modal */}
      {showModal && reward && (
        <div 
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
          onClick={handleCloseModal}
        >
          <div 
            className={`bg-gradient-to-br ${themeStyles.gradient} rounded-3xl p-8 md:p-12 max-w-md w-full shadow-2xl relative animate-reward-pop`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Confetti effect */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              {[...Array(20)].map((_, i) => {
                const randomLeft = Math.random() * 100;
                const randomDelay = Math.random() * 0.5;
                const randomDuration = 1.5 + Math.random() * 1;
                const randomDrift = (Math.random() - 0.5) * 100;
                return (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-confetti"
                    style={{
                      left: `${randomLeft}%`,
                      top: '-10px',
                      animationDelay: `${randomDelay}s`,
                      animationDuration: `${randomDuration}s`,
                      '--confetti-drift': `${randomDrift}px`,
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>

            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10"
            >
              <X size={24} />
            </button>

            <div className="text-center space-y-6 relative z-10">
              {/* Reward Icon - Large */}
              <div className="flex justify-center">
                <div className="p-8 bg-white/20 rounded-full backdrop-blur-sm animate-bounce-subtle">
                  <span className="text-6xl">{reward.icon}</span>
                </div>
              </div>

              {/* Title */}
              <div>
                <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-2">
                  {reward.name}
                </h2>
                <p className="text-white/90 text-lg md:text-xl">
                  {reward.description}
                </p>
                {reward.duration && (
                  <p className="text-white/70 text-sm mt-2">
                    Geldig voor {reward.duration} {reward.duration === 1 ? 'dag' : 'dagen'}
                  </p>
                )}
              </div>

              {/* Reward Details */}
              {reward.type === 'promo_code' && reward.value && (
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/30">
                  <p className="text-white/80 text-sm uppercase tracking-wider mb-2">Promo Code</p>
                  <div className="flex items-center justify-center gap-3">
                    <code className="text-3xl font-black text-white tracking-wider bg-white/10 px-6 py-3 rounded-xl">
                      {reward.value}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(reward.value as string);
                      }}
                      className="text-white/80 hover:text-white transition-colors"
                      title="Copy code"
                    >
                      📋
                    </button>
                  </div>
                </div>
              )}

              {/* Pro Extension Applied Message */}
              {reward.type === 'pro_extension' && (
                <div className="bg-emerald-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-emerald-500/30">
                  <p className="text-white/90 text-base font-semibold">
                    ✅ Your Pro subscription has been automatically extended!
                  </p>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleCloseModal}
                className="w-full bg-white text-red-600 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl text-lg"
              >
                Awesome!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

