"use client";

import { useEffect, useState, useRef } from 'react';
import { X, Gift, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SinterklaasPromoProps {
  steamId?: string | null;
  onDismiss: () => void;
  onClaim: () => void;
}

export default function SinterklaasPromo({ steamId, onDismiss, onClaim }: SinterklaasPromoProps) {
  const router = useRouter();
  const [giftOpened, setGiftOpened] = useState(false);
  const [sinterklaasVisible, setSinterklaasVisible] = useState(false);
  const [throwAttempt, setThrowAttempt] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

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
      gradient.addColorStop(0, 'rgba(220, 20, 60, 0)');
      gradient.addColorStop(0.5, 'rgba(220, 20, 60, 0.15)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      time += 10;
      animationFrameRef.current = requestAnimationFrame(drawEffect);
    };

    drawEffect();
    const handleResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { setSinterklaasVisible(true); setThrowAttempt(1); }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (throwAttempt === 1) { const timer = setTimeout(() => setThrowAttempt(2), 2000); return () => clearTimeout(timer); }
    else if (throwAttempt === 2) { const timer = setTimeout(() => setThrowAttempt(3), 2000); return () => clearTimeout(timer); }
    else if (throwAttempt === 3) { const timer = setTimeout(() => setGiftOpened(true), 1500); return () => clearTimeout(timer); }
  }, [throwAttempt]);

  const handleClaim = async () => {
    setClaiming(true);
    try { router.push('/pro?promo=sinterklaas2025&discount=200'); onClaim(); }
    catch (error) { console.error('Failed to claim promo:', error); }
    finally { setClaiming(false); }
  };

  if (!giftOpened) {
    return (
      <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
        {sinterklaasVisible && (
          <div className={`absolute top-[-10%] right-[-10%] transform transition-all duration-3000 ease-in-out ${
            throwAttempt === 1 ? 'translate-x-[-20vw] translate-y-[20vh]' : 
            throwAttempt === 2 ? 'translate-x-[-40vw] translate-y-[40vh]' : 
            throwAttempt === 3 ? 'translate-x-[-60vw] translate-y-[60vh]' : 'translate-x-[-80vw] translate-y-[80vh]'
          }`} style={{ width: '350px', height: '250px', zIndex: 10001 }}>
            <svg viewBox="0 0 350 250" className="w-full h-full">
              <g transform="translate(200, 100)">
                {/* Mitre (Bishop's hat) */}
                <path d="M-25 -60 L-25 -80 L0 -95 L25 -80 L25 -60" fill="#C41E3A" />
                <rect x="-25" y="-60" width="50" height="15" fill="#C41E3A" />
                <circle cx="0" cy="-80" r="6" fill="white" />
                {/* Head */}
                <circle cx="0" cy="0" r="28" fill="#FDBCB4" />
                {/* Beard */}
                <path d="M-25 10 Q0 40 25 10" stroke="white" strokeWidth="12" fill="white" strokeLinecap="round" />
                {/* Eyes */}
                <circle cx="-10" cy="-8" r="4" fill="#000" />
                <circle cx="10" cy="-8" r="4" fill="#000" />
                {/* Nose */}
                <ellipse cx="0" cy="2" rx="4" ry="3" fill="#FF8C69" />
                {/* Body */}
                <ellipse cx="0" cy="55" rx="40" ry="60" fill="#C41E3A" />
                <rect x="-40" y="45" width="80" height="30" fill="#8B0000" />
                {/* Arms */}
                <g transform={`rotate(${throwAttempt === 3 ? 45 : 0})`}>
                  <ellipse cx="-45" cy="45" rx="10" ry="35" fill="#C41E3A" />
                  <circle cx="-45" cy="25" r="12" fill="#FDBCB4" />
                </g>
                <g transform={`rotate(${throwAttempt === 3 ? -45 : 0})`}>
                  <ellipse cx="45" cy="45" rx="10" ry="35" fill="#C41E3A" />
                  <circle cx="45" cy="25" r="12" fill="#FDBCB4" />
                </g>
                {/* Staff */}
                <line x1="-50" y1="60" x2="-50" y2="120" stroke="#8B4513" strokeWidth="6" />
                <circle cx="-50" cy="120" r="8" fill="#FFD700" />
              </g>

              {/* Gift being thrown */}
              {throwAttempt > 0 && throwAttempt <= 3 && (
                <g transform={`translate(${throwAttempt === 1 ? 280 : throwAttempt === 2 ? 300 : 400}, ${
                  throwAttempt === 1 ? 130 : throwAttempt === 2 ? 150 : 210
                }) rotate(${throwAttempt * 30})`} opacity={throwAttempt === 3 ? 1 : 0.3}>
                  <rect x="-18" y="-18" width="36" height="36" fill="#C41E3A" rx="4" />
                  <rect x="-15" y="-15" width="30" height="30" fill="#16A34A" rx="3" />
                  <line x1="0" y1="-18" x2="0" y2="18" stroke="#DC2626" strokeWidth="2" />
                  <line x1="-18" y1="0" x2="18" y2="0" stroke="#DC2626" strokeWidth="2" />
                </g>
              )}
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-red-600/95 to-red-700/95 border-4 border-white/40 rounded-3xl p-8 md:p-12 max-w-lg w-full shadow-2xl animate-scale-in">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-white/90 hover:text-white transition-colors z-10"><X size={24} /></button>
        <div className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-bounce">
              <rect x="20" y="20" width="60" height="60" fill="#C41E3A" rx="5" />
              <rect x="25" y="25" width="50" height="50" fill="#16A34A" rx="3" />
              <line x1="50" y1="20" x2="50" y2="80" stroke="#DC2626" strokeWidth="3" />
              <line x1="20" y1="50" x2="80" y2="50" stroke="#DC2626" strokeWidth="3" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">Sinterklaas Korting!</h2>
            <p className="text-lg md:text-xl text-white/90 font-bold">€2 korting op SkinVault Pro</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center"><p className="text-sm text-white/70 uppercase tracking-wider">Normale Prijs</p><p className="text-2xl font-black text-white line-through">€9.99</p></div>
              <div className="text-3xl text-white">→</div>
              <div className="text-center"><p className="text-sm text-white/70 uppercase tracking-wider">Nu</p><p className="text-3xl font-black text-white">€7.99</p></div>
            </div>
            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-white" /><span>Onbeperkte price trackers</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-white" /><span>Onbeperkte wishlist items</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-white" /><span>Exclusieve Pro features</span></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleClaim} disabled={claiming} className="flex-1 bg-white text-red-600 py-4 rounded-2xl font-black uppercase tracking-wider hover:bg-gray-100 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              {claiming ? <>Bezig...</> : <><Gift size={20} /> Claim Korting</>}
            </button>
            <button onClick={onDismiss} className="px-6 py-4 bg-white/10 text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-white/20 transition-all border border-white/30">Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}
