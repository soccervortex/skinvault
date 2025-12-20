"use client";

import { useEffect, useState, useRef } from 'react';
import { X, Gift, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChristmasPromoProps {
  steamId?: string | null;
  onDismiss: () => void;
  onClaim: () => void;
}

export default function ChristmasPromo({ steamId, onDismiss, onClaim }: ChristmasPromoProps) {
  const router = useRouter();
  const [giftOpened, setGiftOpened] = useState(false);
  const [santaVisible, setSantaVisible] = useState(false);
  const [throwAttempt, setThrowAttempt] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Northern Lights Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let time = 0;

    const drawNorthernLights = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Create aurora effect with green gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
      gradient.addColorStop(0.3, 'rgba(34, 197, 94, 0.15)');
      gradient.addColorStop(0.6, 'rgba(34, 197, 94, 0.2)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');

      ctx.fillStyle = gradient;
      
      // Create wave effect
      const wave1 = Math.sin(time * 0.001) * 50;
      const wave2 = Math.sin(time * 0.0015 + 1) * 40;
      const wave3 = Math.sin(time * 0.002 + 2) * 60;

      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.bezierCurveTo(
        canvas.width * 0.2 + wave1, canvas.height * 0.3,
        canvas.width * 0.4 + wave2, canvas.height * 0.5,
        canvas.width * 0.6 + wave3, canvas.height * 0.4
      );
      ctx.bezierCurveTo(
        canvas.width * 0.8 + wave1, canvas.height * 0.3,
        canvas.width, canvas.height * 0.2,
        canvas.width, canvas.height
      );
      ctx.lineTo(0, canvas.height);
      ctx.fill();

      time += 10;
      animationFrameRef.current = requestAnimationFrame(drawNorthernLights);
    };

    drawNorthernLights();

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
    // Show santa animation
    const timer = setTimeout(() => {
      setSantaVisible(true);
      setThrowAttempt(1);
    }, 1000);

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
        setGiftOpened(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [throwAttempt]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      router.push('/pro?promo=christmas2025&discount=200');
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
        {/* Northern Lights Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {/* Santa with Sleigh and Reindeer */}
        {santaVisible && (
          <div 
            className={`absolute top-[-10%] right-[-10%] transform transition-all duration-3000 ease-in-out ${
              throwAttempt === 1 ? 'translate-x-[-20vw] translate-y-[20vh]' : 
              throwAttempt === 2 ? 'translate-x-[-40vw] translate-y-[40vh]' : 
              throwAttempt === 3 ? 'translate-x-[-60vw] translate-y-[60vh]' :
              'translate-x-[-80vw] translate-y-[80vh]'
            }`}
            style={{ 
              width: '400px',
              height: '200px',
              zIndex: 10001,
              filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))'
            }}
          >
            <svg viewBox="0 0 400 200" className="w-full h-full">
              {/* Reindeer */}
              <g transform="translate(50, 100)">
                {/* Body */}
                <ellipse cx="0" cy="0" rx="25" ry="15" fill="#8B4513" />
                {/* Head */}
                <circle cx="0" cy="-15" r="12" fill="#8B4513" />
                {/* Antlers */}
                <path d="M-5 -20 L-10 -35 L-8 -30 L-12 -40 M5 -20 L10 -35 L8 -30 L12 -40" stroke="#654321" strokeWidth="2" fill="none" />
                {/* Legs */}
                <line x1="-15" y1="10" x2="-15" y2="25" stroke="#8B4513" strokeWidth="3" />
                <line x1="15" y1="10" x2="15" y2="25" stroke="#8B4513" strokeWidth="3" />
              </g>
              
              {/* Sleigh */}
              <g transform="translate(150, 130)">
                {/* Sleigh body */}
                <path d="M-40 0 Q-40 -20 0 -20 Q40 -20 40 0 L40 10 L-40 10 Z" fill="#C41E3A" />
                <rect x="-40" y="0" width="80" height="15" fill="#8B0000" rx="5" />
                {/* Runners */}
                <ellipse cx="-30" cy="25" rx="30" ry="5" fill="#4A4A4A" />
                <ellipse cx="30" cy="25" rx="30" ry="5" fill="#4A4A4A" />
              </g>

              {/* Santa */}
              <g transform="translate(200, 80)">
                {/* Body */}
                <ellipse cx="0" cy="30" rx="35" ry="40" fill="#C41E3A" />
                {/* Head */}
                <circle cx="0" cy="0" r="25" fill="#FDBCB4" />
                {/* Hat */}
                <path d="M-25 -15 L-25 -35 L0 -50 L25 -35 L25 -15 Z" fill="#C41E3A" />
                <circle cx="0" cy="-35" r="8" fill="white" />
                {/* Beard */}
                <path d="M-20 5 Q0 25 20 5" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" />
                {/* Arms (throwing) */}
                <g transform={`rotate(${throwAttempt === 3 ? 45 : 0})`}>
                  <ellipse cx="-30" cy="20" rx="8" ry="25" fill="#C41E3A" />
                  <circle cx="-30" cy="5" r="12" fill="#FDBCB4" />
                </g>
                <g transform={`rotate(${throwAttempt === 3 ? -45 : 0})`}>
                  <ellipse cx="30" cy="20" rx="8" ry="25" fill="#C41E3A" />
                  <circle cx="30" cy="5" r="12" fill="#FDBCB4" />
                </g>
              </g>

              {/* Gift being thrown */}
              {throwAttempt > 0 && throwAttempt <= 3 && (
                <g 
                  transform={`translate(${
                    throwAttempt === 1 ? 280 : 
                    throwAttempt === 2 ? 300 : 
                    400
                  }, ${
                    throwAttempt === 1 ? 100 : 
                    throwAttempt === 2 ? 120 : 
                    180
                  }) rotate(${throwAttempt * 45})`}
                  opacity={throwAttempt === 3 ? 1 : 0.3}
                >
                  <rect x="-15" y="-15" width="30" height="30" fill="#C41E3A" rx="3" />
                  <rect x="-12" y="-12" width="24" height="24" fill="#16A34A" rx="2" />
                  <line x1="0" y1="-15" x2="0" y2="15" stroke="#DC2626" strokeWidth="2" />
                  <line x1="-15" y1="0" x2="15" y2="0" stroke="#DC2626" strokeWidth="2" />
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
      <div className="relative bg-gradient-to-br from-red-600/95 to-green-600/95 border-4 border-white/40 rounded-3xl p-8 md:p-12 max-w-lg w-full shadow-2xl animate-scale-in">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-white/90 hover:text-white transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="text-center space-y-6">
          {/* Gift icon */}
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-bounce">
              <rect x="20" y="20" width="60" height="60" fill="#C41E3A" rx="5" />
              <rect x="25" y="25" width="50" height="50" fill="#16A34A" rx="3" />
              <line x1="50" y1="20" x2="50" y2="80" stroke="#DC2626" strokeWidth="3" />
              <line x1="20" y1="50" x2="80" y2="50" stroke="#DC2626" strokeWidth="3" />
              <path d="M20 20 L30 10 L70 10 L80 20" fill="#FFD700" />
            </svg>
          </div>

          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">
              Kerstkorting! 🎄
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
                <p className="text-3xl font-black text-green-300">€7.99</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-300" />
                <span>Onbeperkte price trackers</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-300" />
                <span>Onbeperkte wishlist items</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-300" />
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
