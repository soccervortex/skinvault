"use client";

import { useEffect, useState, useRef } from 'react';
import { X, Gift, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface NewYearPromoProps {
  steamId?: string | null;
  onDismiss: () => void;
  onClaim: () => void;
}

export default function NewYearPromo({ steamId, onDismiss, onClaim }: NewYearPromoProps) {
  const router = useRouter();
  const [giftOpened, setGiftOpened] = useState(false);
  const [fireworksVisible, setFireworksVisible] = useState(false);
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

    const drawFireworks = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw multiple firework bursts
      for (let i = 0; i < 5; i++) {
        const x = (canvas.width / 6) * (i + 1);
        const y = canvas.height * 0.3;
        const burstTime = (time + i * 1000) % 2000;
        const alpha = Math.sin(burstTime * Math.PI / 2000);
        
        if (alpha > 0) {
          for (let j = 0; j < 12; j++) {
            const angle = (j / 12) * Math.PI * 2;
            const distance = (burstTime / 2000) * 50;
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance;
            
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, ${215 + j * 2}, 0, ${alpha * 0.8})`;
            ctx.fill();
          }
        }
      }

      // Background glow
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0)');
      gradient.addColorStop(0.3, 'rgba(255, 215, 0, 0.1)');
      gradient.addColorStop(0.7, 'rgba(192, 192, 192, 0.1)');
      gradient.addColorStop(1, 'rgba(192, 192, 192, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 15;
      animationFrameRef.current = requestAnimationFrame(drawFireworks);
    };

    drawFireworks();
    const handleResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { setFireworksVisible(true); setThrowAttempt(1); }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (throwAttempt === 1) { const timer = setTimeout(() => setThrowAttempt(2), 2000); return () => clearTimeout(timer); }
    else if (throwAttempt === 2) { const timer = setTimeout(() => setThrowAttempt(3), 2000); return () => clearTimeout(timer); }
    else if (throwAttempt === 3) { const timer = setTimeout(() => setGiftOpened(true), 1500); return () => clearTimeout(timer); }
  }, [throwAttempt]);

  const handleClaim = async () => {
    setClaiming(true);
    try { router.push('/pro?promo=newyear2025&discount=200'); onClaim(); }
    catch (error) { console.error('Failed to claim promo:', error); }
    finally { setClaiming(false); }
  };

  if (!giftOpened) {
    return (
      <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
        {fireworksVisible && (
          <div className={`absolute top-[10%] right-[5%] transform transition-all duration-3000 ease-in-out ${
            throwAttempt === 1 ? 'translate-x-[-15vw] translate-y-[10vh]' : 
            throwAttempt === 2 ? 'translate-x-[-30vw] translate-y-[20vh]' : 
            throwAttempt === 3 ? 'translate-x-[-50vw] translate-y-[30vh]' : 'translate-x-[-70vw] translate-y-[40vh]'
          }`} style={{ width: '200px', height: '200px', zIndex: 10001 }}>
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Firework burst */}
              <g>
                {[...Array(12)].map((_, i) => {
                  const angle = (i / 12) * Math.PI * 2;
                  const x = 100 + Math.cos(angle) * 40;
                  const y = 100 + Math.sin(angle) * 40;
                  return (
                    <circle key={i} cx={x} cy={y} r="4" fill="#FFD700">
                      <animate attributeName="r" values="2;6;2" dur="1s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />
                    </circle>
                  );
                })}
                <circle cx="100" cy="100" r="8" fill="#FFD700">
                  <animate attributeName="r" values="6;10;6" dur="0.5s" repeatCount="indefinite" />
                </circle>
              </g>
            </svg>
          </div>
        )}

        {/* Sparkle being thrown */}
        {throwAttempt > 0 && throwAttempt <= 3 && (
          <div className={`absolute transform transition-all duration-1000 ${
            throwAttempt === 1 ? 'top-[30vh] left-[70vw] translate-x-[-200px] translate-y-[-50px] scale-50 opacity-0' :
            throwAttempt === 2 ? 'top-[40vh] left-[60vw] translate-x-[200px] translate-y-[-100px] scale-75 opacity-0' :
            throwAttempt === 3 ? 'top-[50vh] left-[50vw] translate-x-0 translate-y-0 scale-100 opacity-100' :
            'top-[50vh] left-[50vw] translate-x-0 translate-y-0 scale-100 opacity-100'
          }`} style={{ width: '60px', height: '60px', zIndex: 10000, pointerEvents: 'none' }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="#FFD700">
                <animate attributeName="opacity" values="1;0.7;1" dur="0.5s" repeatCount="indefinite" />
              </path>
              <circle cx="50" cy="50" r="8" fill="#FFD700" opacity="0.8">
                <animate attributeName="r" values="6;10;6" dur="0.5s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-yellow-500/95 to-yellow-600/95 border-4 border-yellow-300/40 rounded-3xl p-8 md:p-12 max-w-lg w-full shadow-2xl animate-scale-in">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-white/90 hover:text-white transition-colors z-10"><X size={24} /></button>
        <div className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-bounce">
              <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="#FFD700" />
              <circle cx="50" cy="50" r="15" fill="#FFD700" opacity="0.6" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">Nieuwjaar Korting!</h2>
            <p className="text-lg md:text-xl text-white/90 font-bold">€2 korting op SkinVault Pro</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center"><p className="text-sm text-white/70 uppercase tracking-wider">Normale Prijs</p><p className="text-2xl font-black text-white line-through">€9.99</p></div>
              <div className="text-3xl text-white">→</div>
              <div className="text-center"><p className="text-sm text-white/70 uppercase tracking-wider">Nu</p><p className="text-3xl font-black text-yellow-200">€7.99</p></div>
            </div>
            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-yellow-200" /><span>Onbeperkte price trackers</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-yellow-200" /><span>Onbeperkte wishlist items</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-yellow-200" /><span>Exclusieve Pro features</span></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleClaim} disabled={claiming} className="flex-1 bg-white text-yellow-600 py-4 rounded-2xl font-black uppercase tracking-wider hover:bg-gray-100 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              {claiming ? <>Bezig...</> : <><Gift size={20} /> Claim Korting</>}
            </button>
            <button onClick={onDismiss} className="px-6 py-4 bg-white/10 text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-white/20 transition-all border border-white/30">Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}
