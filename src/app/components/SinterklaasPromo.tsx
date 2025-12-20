"use client";

import { useEffect, useState } from 'react';
import { X, Gift, Sparkles, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SinterklaasPromoProps {
  steamId?: string | null;
  onDismiss: () => void;
  onClaim: () => void;
}

export default function SinterklaasPromo({ steamId, onDismiss, onClaim }: SinterklaasPromoProps) {
  const router = useRouter();
  const [showGift, setShowGift] = useState(false);
  const [giftOpened, setGiftOpened] = useState(false);
  const [giftThrown, setGiftThrown] = useState(false);
  const [throwAttempt, setThrowAttempt] = useState(0);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    // Start animation: Sinterklaas throws gift (miss 2x, hit 3rd time)
    const timer = setTimeout(() => {
      setGiftThrown(true);
      setThrowAttempt(1);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (throwAttempt === 1) {
      const timer = setTimeout(() => {
        setThrowAttempt(2);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (throwAttempt === 2) {
      const timer = setTimeout(() => {
        setThrowAttempt(3);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (throwAttempt === 3) {
      const timer = setTimeout(() => {
        setShowGift(true);
        setTimeout(() => {
          setGiftOpened(true);
        }, 1000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [throwAttempt]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      router.push('/pro?promo=sinterklaas2025&discount=200');
      onClaim();
    } catch (error) {
      console.error('Failed to claim promo:', error);
    } finally {
      setClaiming(false);
    }
  };

  if (!giftOpened) {
    return (
      <div className="fixed inset-0 z-[10000] pointer-events-none">
        {/* Red/white gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/10 to-white/5 animate-pulse" 
             style={{
               background: 'linear-gradient(180deg, transparent 0%, rgba(220, 20, 60, 0.15) 50%, rgba(255, 255, 255, 0.05) 100%)',
               animation: 'aurora 4s ease-in-out infinite'
             }} />
        
        {/* Sinterklaas - coming from top right */}
        {giftThrown && throwAttempt <= 3 && (
          <div 
            className={`absolute top-0 right-0 transform transition-all duration-2000 ${
              throwAttempt === 1 ? 'translate-x-[-15vw] translate-y-[15vh]' : 
              throwAttempt === 2 ? 'translate-x-[-30vw] translate-y-[30vh]' : 
              throwAttempt === 3 ? 'translate-x-[-45vw] translate-y-[45vh]' :
              'translate-x-[-60vw] translate-y-[60vh]'
            }`}
            style={{ 
              fontSize: '4rem',
              filter: 'drop-shadow(0 0 10px rgba(220, 20, 60, 0.8))',
              zIndex: 10001
            }}
          >
            🎅
          </div>
        )}

        {/* Gift flying/bouncing */}
        {giftThrown && throwAttempt <= 3 && (
          <div 
            className={`absolute transform transition-all duration-1000 ${
              throwAttempt === 1 ? 'top-[20vh] left-[70vw] translate-x-[-200px] translate-y-[-50px] scale-50 opacity-0' :
              throwAttempt === 2 ? 'top-[30vh] left-[60vw] translate-x-[200px] translate-y-[-100px] scale-75 opacity-0' :
              throwAttempt === 3 ? 'top-[50vh] left-[50vw] translate-x-0 translate-y-0 scale-100 opacity-100' :
              'top-[50vh] left-[50vw] translate-x-0 translate-y-0 scale-100 opacity-100'
            }`}
            style={{ 
              fontSize: '3rem',
              zIndex: 10000,
              pointerEvents: 'none'
            }}
          >
            🎁
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-red-600/90 to-red-700/90 border-4 border-white/30 rounded-3xl p-8 md:p-12 max-w-lg w-full shadow-2xl animate-scale-in">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center space-y-6">
          {/* Gift icon */}
          <div className="mx-auto w-24 h-24 flex items-center justify-center text-6xl animate-bounce">
            🎁
          </div>

          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">
              Sinterklaas Korting! 🎅
            </h2>
            <p className="text-lg md:text-xl text-white/90 font-bold">
              €2 korting op SkinVault Pro
            </p>
          </div>

          <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-white/70 uppercase tracking-wider">Normale Prijs</p>
                <p className="text-2xl font-black text-white line-through">€9.99</p>
              </div>
              <div className="text-3xl text-white">→</div>
              <div className="text-center">
                <p className="text-sm text-white/70 uppercase tracking-wider">Nu</p>
                <p className="text-3xl font-black text-white">€7.99</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-white" />
                <span>Onbeperkte price trackers</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-white" />
                <span>Onbeperkte wishlist items</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-white" />
                <span>Exclusieve Pro features</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="flex-1 bg-white text-red-600 py-4 rounded-2xl font-black uppercase tracking-wider hover:bg-gray-100 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {claiming ? (
                <>Bezig...</>
              ) : (
                <>
                  <Gift size={20} />
                  Claim Korting
                </>
              )}
            </button>
            <button
              onClick={onDismiss}
              className="px-6 py-4 bg-white/10 text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-white/20 transition-all border border-white/30"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

