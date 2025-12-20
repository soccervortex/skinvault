"use client";

import { useEffect, useState, useRef } from 'react';
import { X, Gift, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EasterPromoProps {
  steamId?: string | null;
  onDismiss: () => void;
  onClaim: () => void;
}

export default function EasterPromo({ steamId, onDismiss, onClaim }: EasterPromoProps) {
  const router = useRouter();
  const [giftOpened, setGiftOpened] = useState(false);
  const [bunnyVisible, setBunnyVisible] = useState(false);
  const [throwAttempt, setThrowAttempt] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

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
      gradient.addColorStop(0, 'rgba(255, 179, 217, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 179, 217, 0.15)');
      gradient.addColorStop(1, 'rgba(179, 217, 255, 0.15)');
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
    const timer = setTimeout(() => { setBunnyVisible(true); setThrowAttempt(1); }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (throwAttempt === 1) { const timer = setTimeout(() => setThrowAttempt(2), 2000); return () => clearTimeout(timer); }
    else if (throwAttempt === 2) { const timer = setTimeout(() => setThrowAttempt(3), 2000); return () => clearTimeout(timer); }
    else if (throwAttempt === 3) { const timer = setTimeout(() => setGiftOpened(true), 1500); return () => clearTimeout(timer); }
  }, [throwAttempt]);

  const handleClaim = async () => {
    setClaiming(true);
    try { router.push('/pro?promo=easter2025&discount=200'); onClaim(); }
    catch (error) { console.error('Failed to claim promo:', error); }
    finally { setClaiming(false); }
  };

  if (!giftOpened) {
    return (
      <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
        {bunnyVisible && (
          <div className={`absolute top-[-10%] right-[-10%] transform transition-all duration-3000 ease-in-out ${
            throwAttempt === 1 ? 'translate-x-[-20vw] translate-y-[20vh]' : 
            throwAttempt === 2 ? 'translate-x-[-40vw] translate-y-[40vh]' : 
            throwAttempt === 3 ? 'translate-x-[-60vw] translate-y-[60vh]' : 'translate-x-[-80vw] translate-y-[80vh]'
          }`} style={{ width: '300px', height: '250px', zIndex: 10001 }}>
            <svg viewBox="0 0 300 250" className="w-full h-full">
              <g transform="translate(150, 150)">
                {/* Bunny body */}
                <ellipse cx="0" cy="20" rx="40" ry="50" fill="#F5F5DC" />
                {/* Head */}
                <ellipse cx="0" cy="-30" rx="35" ry="40" fill="#F5F5DC" />
                {/* Ears */}
                <ellipse cx="-20" cy="-60" rx="8" ry="35" fill="#F5F5DC" transform="rotate(-20)" />
                <ellipse cx="20" cy="-60" rx="8" ry="35" fill="#F5F5DC" transform="rotate(20)" />
                <ellipse cx="-20" cy="-65" rx="5" ry="25" fill="#FFB3D9" transform="rotate(-20)" />
                <ellipse cx="20" cy="-65" rx="5" ry="25" fill="#FFB3D9" transform="rotate(20)" />
                {/* Eyes */}
                <circle cx="-12" cy="-35" r="4" fill="#000" />
                <circle cx="12" cy="-35" r="4" fill="#000" />
                {/* Nose */}
                <ellipse cx="0" cy="-25" rx="3" ry="2" fill="#FF69B4" />
                {/* Mouth */}
                <path d="M0 -25 Q-5 -20 -8 -15" stroke="#000" strokeWidth="1.5" fill="none" />
                <path d="M0 -25 Q5 -20 8 -15" stroke="#000" strokeWidth="1.5" fill="none" />
                {/* Arms */}
                <g transform={`rotate(${throwAttempt === 3 ? 45 : 0})`}>
                  <ellipse cx="-35" cy="10" rx="12" ry="25" fill="#F5F5DC" />
                  <circle cx="-35" cy="-5" r="8" fill="#F5F5DC" />
                </g>
                <g transform={`rotate(${throwAttempt === 3 ? -45 : 0})`}>
                  <ellipse cx="35" cy="10" rx="12" ry="25" fill="#F5F5DC" />
                  <circle cx="35" cy="-5" r="8" fill="#F5F5DC" />
                </g>
              </g>

              {/* Easter egg being thrown */}
              {throwAttempt > 0 && throwAttempt <= 3 && (
                <g transform={`translate(${throwAttempt === 1 ? 250 : throwAttempt === 2 ? 270 : 350}, ${
                  throwAttempt === 1 ? 150 : throwAttempt === 2 ? 170 : 230
                }) rotate(${throwAttempt * 20})`} opacity={throwAttempt === 3 ? 1 : 0.3}>
                  <ellipse cx="0" cy="0" rx="18" ry="25" fill="#FFB3D9" />
                  <path d="M-18 0 Q0 -10 18 0" stroke="#B3D9FF" strokeWidth="2" fill="none" />
                  <circle cx="0" cy="-8" r="4" fill="#FFF4B3" />
                  <circle cx="-8" cy="5" r="3" fill="#B3D9FF" />
                  <circle cx="8" cy="8" r="3" fill="#FFB3D9" />
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
      <div className="relative bg-gradient-to-br from-pink-400/95 to-blue-400/95 border-4 border-pink-200/40 rounded-3xl p-8 md:p-12 max-w-lg w-full shadow-2xl animate-scale-in">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-white/90 hover:text-white transition-colors z-10"><X size={24} /></button>
        <div className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-bounce">
              <ellipse cx="50" cy="50" rx="30" ry="40" fill="#FFB3D9" />
              <path d="M20 50 Q50 40 80 50" stroke="#B3D9FF" strokeWidth="3" fill="none" />
              <circle cx="50" cy="35" r="6" fill="#FFF4B3" />
              <circle cx="35" cy="55" r="5" fill="#B3D9FF" />
              <circle cx="65" cy="60" r="5" fill="#FFB3D9" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">Paas Korting!</h2>
            <p className="text-lg md:text-xl text-white/90 font-bold">€2 korting op SkinVault Pro</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center"><p className="text-sm text-white/70 uppercase tracking-wider">Normale Prijs</p><p className="text-2xl font-black text-white line-through">€9.99</p></div>
              <div className="text-3xl text-white">→</div>
              <div className="text-center"><p className="text-sm text-white/70 uppercase tracking-wider">Nu</p><p className="text-3xl font-black text-pink-200">€7.99</p></div>
            </div>
            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-pink-200" /><span>Onbeperkte price trackers</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-pink-200" /><span>Onbeperkte wishlist items</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-pink-200" /><span>Exclusieve Pro features</span></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleClaim} disabled={claiming} className="flex-1 bg-white text-pink-500 py-4 rounded-2xl font-black uppercase tracking-wider hover:bg-gray-100 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              {claiming ? <>Bezig...</> : <><Gift size={20} /> Claim Korting</>}
            </button>
            <button onClick={onDismiss} className="px-6 py-4 bg-white/10 text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-white/20 transition-all border border-white/30">Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}
