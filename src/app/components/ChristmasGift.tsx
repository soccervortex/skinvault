"use client";

import { useState, useEffect } from 'react';
import { Gift, X, Sparkles } from 'lucide-react';
import { getRandomReward, saveReward, type Reward } from '@/app/utils/christmas-rewards';

interface ChristmasGiftProps {
  steamId?: string | null;
}

export default function ChristmasGift({ steamId }: ChristmasGiftProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reward, setReward] = useState<Reward | null>(null);

  useEffect(() => {
    const checkClaimStatus = async () => {
      if (!steamId) {
        // For non-logged-in users, check localStorage as fallback
        if (typeof window !== 'undefined') {
          setHasClaimed(localStorage.getItem('sv_christmas_gift_claimed_2024') === 'true');
        }
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(`/api/gift/claim?steamId=${steamId}`);
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
  }, [steamId]);

  const handleGiftClick = async () => {
    if (hasClaimed || isOpening || checking || !steamId) {
      // For non-logged-in users, show message
      if (!steamId) {
        alert('Log in met Steam om je cadeautje te openen!');
      }
      return;
    }
    
    setIsOpening(true);
    
    // Get random reward
    const randomReward = getRandomReward();
    setReward(randomReward);
    
    // Animate box opening
    setTimeout(async () => {
      setIsOpening(false);
      setIsOpen(true);
      
      // Save to database
      try {
        const response = await fetch('/api/gift/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steamId, reward: randomReward }),
        });

        if (response.ok) {
          // Also save to localStorage as backup
          saveReward(randomReward);
          setShowModal(true);
          setHasClaimed(true);
        } else {
          const data = await response.json();
          if (data.alreadyClaimed) {
            alert('Je hebt dit cadeautje al geopend!');
            setHasClaimed(true);
          } else {
            alert('Er ging iets mis. Probeer het opnieuw.');
            setIsOpening(false);
            setIsOpen(false);
          }
        }
      } catch (error) {
        console.error('Failed to claim gift:', error);
        alert('Er ging iets mis. Probeer het opnieuw.');
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
          onClick={handleGiftClick}
          className={`fixed bottom-6 right-6 z-[10000] cursor-pointer transition-all duration-300 ${
            isOpening ? 'scale-125' : 'hover:scale-110'
          }`}
          style={{
            animation: isOpening ? 'open-gift 1.5s ease-in-out' : 'bounce-gift 2s ease-in-out infinite',
          }}
        >
          <div
            className="relative w-20 h-20"
            style={{
              transformStyle: 'preserve-3d',
              perspective: '1000px',
            }}
          >
            {/* Gift Box - 3D effect */}
            <div
              className={`absolute inset-0 bg-gradient-to-br from-red-600 via-red-500 to-green-600 rounded-lg shadow-2xl transition-all duration-300 ${
                isOpening ? 'gift-opening' : ''
              }`}
              style={{
                transform: isOpening ? 'rotateX(90deg) translateZ(20px)' : 'rotateX(15deg) rotateY(15deg)',
                boxShadow: '0 10px 30px rgba(220, 38, 38, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.2)',
              }}
            >
              {/* Gift Ribbon */}
              <div className="absolute top-1/2 left-0 right-0 h-4 bg-yellow-400 transform -translate-y-1/2 shadow-lg"></div>
              <div className="absolute left-1/2 top-0 bottom-0 w-4 bg-yellow-400 transform -translate-x-1/2 shadow-lg"></div>
              {/* Bow */}
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-6 h-6 bg-yellow-300 rounded-full shadow-md"></div>
              </div>
              
              {/* Opening effect - light coming out */}
              {isOpening && (
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-200/80 via-white/60 to-transparent rounded-lg animate-pulse"></div>
              )}
            </div>
          </div>
          
          {/* Sparkle effects */}
          <div className="absolute -top-2 -right-2 text-yellow-300 text-2xl animate-pulse">✨</div>
          <div className="absolute -bottom-1 -left-1 text-yellow-200 text-xl animate-pulse delay-300">⭐</div>
        </div>
      )}

      {/* Reward Modal */}
      {showModal && reward && (
        <div 
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-gradient-to-br from-red-600 via-red-500 to-green-600 rounded-3xl p-8 md:p-12 max-w-md w-full shadow-2xl relative animate-reward-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Confetti effect */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 1}s`,
                    animationDuration: `${1 + Math.random() * 1}s`,
                  }}
                />
              ))}
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
                      title="Kopieer code"
                    >
                      📋
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleCloseModal}
                className="w-full bg-white text-red-600 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl text-lg"
              >
                Geweldig!
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes bounce-gift {
          0%, 100% {
            transform: translateX(0) translateY(0) rotate(0deg);
          }
          25% {
            transform: translateX(-10px) translateY(-5px) rotate(-5deg);
          }
          50% {
            transform: translateX(0) translateY(-10px) rotate(0deg);
          }
          75% {
            transform: translateX(10px) translateY(-5px) rotate(5deg);
          }
        }

        @keyframes open-gift {
          0% {
            transform: scale(1) rotate(0deg);
          }
          50% {
            transform: scale(1.3) rotate(5deg);
          }
          100% {
            transform: scale(1.5) rotate(0deg);
          }
        }

        @keyframes reward-pop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          60% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(200px) rotate(360deg);
            opacity: 0;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-reward-pop {
          animation: reward-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }

        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }

        .gift-opening {
          transition: transform 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>
    </>
  );
}
