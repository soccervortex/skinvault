"use client";

import { useEffect, useState, useRef } from 'react';
import { X, Gift, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HalloweenPromoProps {
  steamId?: string | null;
  onDismiss: () => void;
  onClaim: () => void;
}

export default function HalloweenPromo({ steamId, onDismiss, onClaim }: HalloweenPromoProps) {
  const router = useRouter();
  const [giftOpened, setGiftOpened] = useState(false);
  const [witchVisible, setWitchVisible] = useState(false);
  const [throwAttempt, setThrowAttempt] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Spooky orange/purple effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let time = 0;

    const drawEffect = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(255, 140, 0, 0)');
      gradient.addColorStop(0.3, 'rgba(255, 140, 0, 0.15)');
      gradient.addColorStop(0.6, 'rgba(139, 0, 255, 0.15)');
      gradient.addColorStop(1, 'rgba(139, 0, 255, 0)');

      ctx.fillStyle = gradient;
      
      const wave1 = Math.sin(time * 0.001) * 50;
      const wave2 = Math.sin(time * 0.0015 + 1) * 40;

      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.bezierCurveTo(
        canvas.width * 0.3 + wave1, canvas.height * 0.3,
        canvas.width * 0.7 + wave2, canvas.height * 0.5,
        canvas.width, canvas.height
      );
      ctx.lineTo(0, canvas.height);
      ctx.fill();

      time += 10;
      animationFrameRef.current = requestAnimationFrame(drawEffect);
    };

    drawEffect();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setWitchVisible(true);
      setThrowAttempt(1);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (throwAttempt === 1) {
      const timer = setTimeout(() => setThrowAttempt(2), 2000);
      return () => clearTimeout(timer);
    } else if (throwAttempt === 2) {
      const timer = setTimeout(() => setThrowAttempt(3), 2000);
      return () => clearTimeout(timer);
    } else if (throwAttempt === 3) {
      const timer = setTimeout(() => setGiftOpened(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [throwAttempt]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      router.push('/pro?promo=halloween2025&discount=200');
      onClaim();
    } catch (error) {
      console.error('Failed to claim promo:', error);
    } finally {
      setClaiming(false);
    }
  };

  if (!giftOpened) {
    return (
      <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
        
        {witchVisible && (
          <div 
            className={`absolute top-[-10%] right-[-10%] transform transition-all duration-3000 ease-in-out ${
              throwAttempt === 1 ? 'translate-x-[-20vw] translate-y-[20vh]' : 
              throwAttempt === 2 ? 'translate-x-[-40vw] translate-y-[40vh]' : 
              throwAttempt === 3 ? 'translate-x-[-60vw] translate-y-[60vh]' :
              'translate-x-[-80vw] translate-y-[80vh]'
            }`}
            style={{ width: '350px', height: '200px', zIndex: 10001, filter: 'drop-shadow(0 0 20px rgba(255, 140, 0, 0.5))' }}
          >
            <svg viewBox="0 0 350 200" className="w-full h-full">
              {/* Broom */}
              <g transform="translate(50, 120)">
                <rect x="-5" y="-80" width="10" height="100" fill="#654321" />
                <polygon points="-5,-80 5,-80 10,-90 -10,-90" fill="#8B4513" />
              </g>
              
              {/* Witch */}
              <g transform="translate(200, 60)">
                {/* Hat */}
                <path d="M-30 -40 L-30 -60 L0 -75 L30 -60 L30 -40" fill="#000000" />
                <rect x="-30" y="-40" width="60" height="5" fill="#000000" />
                {/* Head */}
                <circle cx="0" cy="0" r="22" fill="#FFDBAC" />
                {/* Hair */}
                <path d="M-22 -5 Q-30 -15 -35 -25 Q-25 -20 -22 -10" fill="#4A4A4A" />
                <path d="M22 -5 Q30 -15 35 -25 Q25 -20 22 -10" fill="#4A4A4A" />
                {/* Eyes */}
                <circle cx="-8" cy="-5" r="3" fill="#000" />
                <circle cx="8" cy="-5" r="3" fill="#000" />
                {/* Nose */}
                <path d="M0 0 Q5 5 0 10" stroke="#8B4513" strokeWidth="2" fill="none" />
                {/* Body */}
                <ellipse cx="0" cy="40" rx="30" ry="50" fill="#8B00FF" />
                {/* Arms */}
                <g transform={`rotate(${throwAttempt === 3 ? 45 : 0})`}>
                  <ellipse cx="-35" cy="30" rx="8" ry="30" fill="#8B00FF" />
                  <circle cx="-35" cy="15" r="10" fill="#FFDBAC" />
                </g>
                <g transform={`rotate(${throwAttempt === 3 ? -45 : 0})`}>
                  <ellipse cx="35" cy="30" rx="8" ry="30" fill="#8B00FF" />
                  <circle cx="35" cy="15" r="10" fill="#FFDBAC" />
                </g>
              </g>

              {/* Pumpkin being thrown */}
              {throwAttempt > 0 && throwAttempt <= 3 && (
                <g 
                  transform={`translate(${
                    throwAttempt === 1 ? 280 : throwAttempt === 2 ? 300 : 400
                  }, ${
                    throwAttempt === 1 ? 100 : throwAttempt === 2 ? 120 : 180
                  }) rotate(${throwAttempt * 30})`}
                  opacity={throwAttempt === 3 ? 1 : 0.3}
                >
                  <ellipse cx="0" cy="0" rx="20" ry="25" fill="#FF8C00" />
                  <path d="M-15 -20 Q0 -25 15 -20" stroke="#654321" strokeWidth="3" fill="none" />
                  <path d="M-10 5 Q0 10 10 5" stroke="#654321" strokeWidth="3" fill="none" />
                  <polygon points="-8,-15 -5,-8 -12,-8" fill="#000" />
                  <polygon points="8,-15 5,-8 12,-8" fill="#000" />
                  <path d="M0 5 Q-5 15 -10 20 Q0 18 10 20 Q5 15 0 5" fill="#000" />
                  <rect x="-3" y="20" width="6" height="8" fill="#654321" />
                </g>
              )}
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-orange-600/95 to-purple-600/95 border-4 border-orange-300/40 rounded-3xl p-8 md:p-12 max-w-lg w-full shadow-2xl animate-scale-in">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-white/90 hover:text-white transition-colors z-10">
          <X size={24} />
        </button>

        <div className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-bounce">
              <ellipse cx="50" cy="50" rx="35" ry="40" fill="#FF8C00" />
              <path d="M30 30 Q50 25 70 30" stroke="#654321" strokeWidth="4" fill="none" />
              <path d="M30 70 Q50 75 70 70" stroke="#654321" strokeWidth="4" fill="none" />
              <polygon points="42,40 38,48 48,48" fill="#000" />
              <polygon points="58,40 54,48 64,48" fill="#000" />
              <path d="M40 60 Q50 70 60 60" stroke="#000" strokeWidth="3" fill="none" />
            </svg>
          </div>

          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">
              Halloween Korting!
            </h2>
            <p className="text-lg md:text-xl text-white/90 font-bold">€2 korting op SkinVault Pro</p>
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
                <p className="text-3xl font-black text-orange-300">€7.99</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-orange-300" />
                <span>Onbeperkte price trackers</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-orange-300" />
                <span>Onbeperkte wishlist items</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-orange-300" />
                <span>Exclusieve Pro features</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleClaim} disabled={claiming} className="flex-1 bg-white text-orange-600 py-4 rounded-2xl font-black uppercase tracking-wider hover:bg-gray-100 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              {claiming ? <>Bezig...</> : <> <Gift size={20} /> Claim Korting </>}
            </button>
            <button onClick={onDismiss} className="px-6 py-4 bg-white/10 text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-white/20 transition-all border border-white/30">Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}
