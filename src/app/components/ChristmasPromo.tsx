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

  // Enhanced Northern Lights Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let time = 0;
    const layers: Array<{ speed: number; offset: number; colors: string[] }> = [
      { speed: 0.0005, offset: 0, colors: ['rgba(34, 197, 94, 0)', 'rgba(34, 197, 94, 0.4)', 'rgba(34, 197, 94, 0.2)', 'rgba(34, 197, 94, 0)'] },
      { speed: 0.0007, offset: Math.PI / 3, colors: ['rgba(16, 185, 129, 0)', 'rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0)'] },
      { speed: 0.0006, offset: Math.PI / 2, colors: ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0)'] },
    ];

    const drawNorthernLights = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      layers.forEach((layer, layerIndex) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        layer.colors.forEach((color, i) => {
          gradient.addColorStop(i / (layer.colors.length - 1), color);
        });

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.8;
        
        // Create multiple wave bands
        for (let band = 0; band < 3; band++) {
          const bandOffset = band * (canvas.width / 3);
          const wavePhase = time * layer.speed + layer.offset + (band * Math.PI / 3);
          
          ctx.beginPath();
          ctx.moveTo(bandOffset, canvas.height);
          
          // Create flowing, organic wave shapes
          for (let x = bandOffset; x < bandOffset + canvas.width / 3; x += 2) {
            const normalizedX = (x - bandOffset) / (canvas.width / 3);
            const wave1 = Math.sin(normalizedX * Math.PI * 2 + wavePhase) * 40;
            const wave2 = Math.sin(normalizedX * Math.PI * 4 + wavePhase * 1.5) * 20;
            const wave3 = Math.sin(normalizedX * Math.PI * 6 + wavePhase * 2) * 10;
            const y = canvas.height * 0.3 + wave1 + wave2 + wave3;
            ctx.lineTo(x, y);
          }
          
          ctx.lineTo(bandOffset + canvas.width / 3, canvas.height);
          ctx.lineTo(bandOffset, canvas.height);
          ctx.fill();
        }
        
        // Add glow effect
        ctx.shadowBlur = 30;
        ctx.shadowColor = layer.colors[1];
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.globalAlpha = 1.0;
      time += 1;
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
    const timer = setTimeout(() => {
      setSantaVisible(true);
      setThrowAttempt(1);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (throwAttempt === 1) {
      const timer = setTimeout(() => setThrowAttempt(2), 2500);
      return () => clearTimeout(timer);
    } else if (throwAttempt === 2) {
      const timer = setTimeout(() => setThrowAttempt(3), 2500);
      return () => clearTimeout(timer);
    } else if (throwAttempt === 3) {
      const timer = setTimeout(() => setGiftOpened(true), 2000);
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

        {/* Santa with Sleigh and Reindeer - Enhanced */}
        {santaVisible && (
          <div 
            className={`absolute top-[-5%] right-[-5%] transform transition-all duration-[4000ms] ease-in-out ${
              throwAttempt === 1 ? 'translate-x-[-25vw] translate-y-[25vh] rotate-[5deg]' : 
              throwAttempt === 2 ? 'translate-x-[-50vw] translate-y-[50vh] rotate-[10deg]' : 
              throwAttempt === 3 ? 'translate-x-[-75vw] translate-y-[75vh] rotate-[15deg]' :
              'translate-x-[-100vw] translate-y-[100vh] rotate-[20deg]'
            }`}
            style={{ 
              width: '450px',
              height: '220px',
              zIndex: 10001,
              filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 15px rgba(34, 197, 94, 0.3))'
            }}
          >
            <svg viewBox="0 0 450 220" className="w-full h-full">
              {/* Reindeer - Enhanced */}
              <g transform="translate(40, 110)">
                {/* Body */}
                <ellipse cx="0" cy="0" rx="28" ry="18" fill="#8B4513" />
                {/* Head */}
                <circle cx="0" cy="-18" r="14" fill="#8B4513" />
                {/* Antlers - More detailed */}
                <path d="M-6 -25 L-12 -42 L-10 -36 L-14 -48 M6 -25 L12 -42 L10 -36 L14 -48" stroke="#654321" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                {/* Eyes */}
                <circle cx="-5" cy="-20" r="2" fill="#000" />
                <circle cx="5" cy="-20" r="2" fill="#000" />
                {/* Nose */}
                <circle cx="0" cy="-15" r="2" fill="#FF6347" />
                {/* Legs */}
                <line x1="-20" y1="12" x2="-20" y2="28" stroke="#8B4513" strokeWidth="4" strokeLinecap="round" />
                <line x1="20" y1="12" x2="20" y2="28" stroke="#8B4513" strokeWidth="4" strokeLinecap="round" />
                {/* Harness */}
                <path d="M-25 0 Q0 -15 25 0" stroke="#4A4A4A" strokeWidth="2" fill="none" />
              </g>
              
              {/* Sleigh - Enhanced with more detail */}
              <g transform="translate(170, 140)">
                {/* Sleigh body */}
                <path d="M-50 0 Q-50 -25 0 -25 Q50 -25 50 0 L50 12 L-50 12 Z" fill="#C41E3A" />
                <path d="M-50 0 Q-50 -25 0 -25 Q50 -25 50 0" stroke="#8B0000" strokeWidth="2" fill="none" />
                <rect x="-50" y="0" width="100" height="18" fill="#8B0000" rx="6" />
                {/* Decorative lines */}
                <line x1="-40" y1="-15" x2="40" y2="-15" stroke="#FFD700" strokeWidth="2" />
                <line x1="-30" y1="-20" x2="30" y2="-20" stroke="#FFD700" strokeWidth="1.5" />
                {/* Runners - More curved */}
                <path d="M-35 30 Q-35 32 -30 33 Q-10 35 0 33 Q10 35 30 33 Q35 32 35 30" fill="#2A2A2A" />
                <path d="M-35 30 Q-35 32 -30 33 Q-10 35 0 33 Q10 35 30 33 Q35 32 35 30" stroke="#1A1A1A" strokeWidth="1" fill="none" />
                {/* Runner supports */}
                <line x1="-35" y1="18" x2="-35" y2="30" stroke="#4A4A4A" strokeWidth="3" />
                <line x1="35" y1="18" x2="35" y2="30" stroke="#4A4A4A" strokeWidth="3" />
              </g>

              {/* Santa - Enhanced */}
              <g transform="translate(280, 70)">
                {/* Body */}
                <ellipse cx="0" cy="35" rx="38" ry="45" fill="#C41E3A" />
                {/* Belt */}
                <rect x="-38" y="35" width="76" height="12" fill="#000000" />
                <circle cx="0" cy="41" r="6" fill="#FFD700" />
                {/* Head */}
                <circle cx="0" cy="0" r="28" fill="#FDBCB4" />
                {/* Hat */}
                <path d="M-28 -18 L-28 -40 L0 -58 L28 -40 L28 -18 Z" fill="#C41E3A" />
                <circle cx="0" cy="-40" r="10" fill="white" />
                <ellipse cx="0" cy="-40" rx="8" ry="4" fill="#FFD700" />
                {/* Beard - More detailed */}
                <path d="M-25 12 Q0 45 25 12" stroke="white" strokeWidth="14" fill="white" strokeLinecap="round" />
                <path d="M-20 8 Q0 35 20 8" stroke="white" strokeWidth="10" fill="white" strokeLinecap="round" />
                {/* Eyes */}
                <circle cx="-10" cy="-8" r="4" fill="#000" />
                <circle cx="10" cy="-8" r="4" fill="#000" />
                {/* Nose */}
                <circle cx="0" cy="2" r="5" fill="#FF8C69" />
                {/* Cheeks */}
                <circle cx="-18" cy="2" r="6" fill="#FFB6C1" opacity="0.6" />
                <circle cx="18" cy="2" r="6" fill="#FFB6C1" opacity="0.6" />
                {/* Arms - Throwing motion */}
                <g transform={`rotate(${throwAttempt === 3 ? 50 : throwAttempt === 2 ? 30 : 0}, -40, 25)`}>
                  <ellipse cx="-40" cy="25" rx="10" ry="32" fill="#C41E3A" />
                  <circle cx="-40" cy="8" r="13" fill="#FDBCB4" />
                </g>
                <g transform={`rotate(${throwAttempt === 3 ? -50 : throwAttempt === 2 ? -30 : 0}, 40, 25)`}>
                  <ellipse cx="40" cy="25" rx="10" ry="32" fill="#C41E3A" />
                  <circle cx="40" cy="8" r="13" fill="#FDBCB4" />
                </g>
              </g>

              {/* Gift being thrown - Enhanced */}
              {throwAttempt > 0 && throwAttempt <= 3 && (
                <g 
                  transform={`translate(${
                    throwAttempt === 1 ? 320 : 
                    throwAttempt === 2 ? 360 : 
                    450
                  }, ${
                    throwAttempt === 1 ? 110 : 
                    throwAttempt === 2 ? 140 : 
                    200
                  }) rotate(${throwAttempt * 50}) scale(${throwAttempt === 3 ? 1.2 : 0.6})`}
                  opacity={throwAttempt === 3 ? 1 : 0.4}
                >
                  <rect x="-20" y="-20" width="40" height="40" fill="#C41E3A" rx="5" />
                  <rect x="-17" y="-17" width="34" height="34" fill="#16A34A" rx="4" />
                  <line x1="0" y1="-20" x2="0" y2="20" stroke="#DC2626" strokeWidth="3" />
                  <line x1="-20" y1="0" x2="20" y2="0" stroke="#DC2626" strokeWidth="3" />
                  {/* Ribbon bow */}
                  <circle cx="0" cy="0" r="8" fill="#FFD700" opacity="0.8" />
                  <ellipse cx="-8" cy="0" rx="6" ry="4" fill="#FFD700" />
                  <ellipse cx="8" cy="0" rx="6" ry="4" fill="#FFD700" />
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
