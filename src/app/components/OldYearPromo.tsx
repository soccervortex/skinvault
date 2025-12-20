"use client";

import { useEffect, useState, useRef } from 'react';
import { X, Gift, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface OldYearPromoProps {
  steamId?: string | null;
  onDismiss: () => void;
  onClaim: () => void;
}

export default function OldYearPromo({ steamId, onDismiss, onClaim }: OldYearPromoProps) {
  const router = useRouter();
  const [giftOpened, setGiftOpened] = useState(false);
  const [particleVisible, setParticleVisible] = useState(false);
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
      gradient.addColorStop(0, 'rgba(169, 169, 169, 0)');
      gradient.addColorStop(0.5, 'rgba(169, 169, 169, 0.08)');
      gradient.addColorStop(1, 'rgba(128, 128, 128, 0.05)');
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
    const timer = setTimeout(() => { setParticleVisible(true); setThrowAttempt(1); }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (throwAttempt === 1) { const timer = setTimeout(() => setThrowAttempt(2), 2000); return () => clearTimeout(timer); }
    else if (throwAttempt === 2) { const timer = setTimeout(() => setThrowAttempt(3), 2000); return () => clearTimeout(timer); }
    else if (throwAttempt === 3) { const timer = setTimeout(() => setGiftOpened(true), 1500); return () => clearTimeout(timer); }
  }, [throwAttempt]);

  const handleClaim = async () => {
    setClaiming(true);
    try { router.push('/pro?promo=oldyear2025&discount=200'); onClaim(); }
    catch (error) { console.error('Failed to claim promo:', error); }
    finally { setClaiming(false); }
  };

  if (!giftOpened) {
    return (
      <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
        {particleVisible && (
          <div className={`absolute top-[10%] right-[5%] transform transition-all duration-3000 ease-in-out ${
            throwAttempt === 1 ? 'translate-x-[-15vw] translate-y-[15vh]' : 
            throwAttempt === 2 ? 'translate-x-[-30vw] translate-y-[30vh]' : 
            throwAttempt === 3 ? 'translate-x-[-50vw] translate-y-[45vh]' : 'translate-x-[-70vw] translate-y-[60vh]'
          }`} style={{ width: '150px', height: '150px', zIndex: 10001, opacity: 0.7 }}>
            <svg viewBox="0 0 150 150" className="w-full h-full">
              <g transform="translate(75, 75)">
                {[...Array(8)].map((_, i) => {
                  const angle = (i / 8) * Math.PI * 2;
                  const x = Math.cos(angle) * 30;
                  const y = Math.sin(angle) * 30;
                  return (
                    <circle key={i} cx={x} cy={y} r="3" fill="#A9A9A9" opacity="0.6">
                      <animate attributeName="r" values="2;5;2" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
                    </circle>
                  );
                })}
                <circle cx="0" cy="0" r="12" fill="#A9A9A9" opacity="0.4">
                  <animate attributeName="r" values="8;15;8" dur="1.5s" repeatCount="indefinite" />
                </circle>
              </g>
            </svg>
          </div>
        )}

        {/* Gift being thrown */}
        {throwAttempt > 0 && throwAttempt <= 3 && (
          <div className={`absolute transform transition-all duration-1000 ${
            throwAttempt === 1 ? 'top-[30vh] left-[70vw] translate-x-[-200px] translate-y-[-50px] scale-50 opacity-0' :
            throwAttempt === 2 ? 'top-[40vh] left-[60vw] translate-x-[200px] translate-y-[-100px] scale-75 opacity-0' :
            throwAttempt === 3 ? 'top-[50vh] left-[50vw] translate-x-0 translate-y-0 scale-100 opacity-100' :
            'top-[50vh] left-[50vw] translate-x-0 translate-y-0 scale-100 opacity-100'
          }`} style={{ width: '50px', height: '50px', zIndex: 10000, pointerEvents: 'none', opacity: 0.8 }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <rect x="20" y="20" width="60" height="60" fill="#696969" rx="5" />
              <rect x="25" y="25" width="50" height="50" fill="#808080" rx="3" />
              <line x1="50" y1="20" x2="50" y2="80" stroke="#A9A9A9" strokeWidth="2" />
              <line x1="20" y1="50" x2="80" y2="50" stroke="#A9A9A9" strokeWidth="2" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-gray-700/95 to-gray-800/95 border-4 border-gray-400/40 rounded-3xl p-8 md:p-12 max-w-lg w-full shadow-2xl animate-scale-in">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-white/90 hover:text-white transition-colors z-10"><X size={24} /></button>
        <div className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-bounce">
              <rect x="20" y="20" width="60" height="60" fill="#696969" rx="5" />
              <rect x="25" y="25" width="50" height="50" fill="#808080" rx="3" />
              <line x1="50" y1="20" x2="50" y2="80" stroke="#A9A9A9" strokeWidth="2" />
              <line x1="20" y1="50" x2="80" y2="50" stroke="#A9A9A9" strokeWidth="2" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">Oudjaar Korting!</h2>
            <p className="text-lg md:text-xl text-white/90 font-bold">€2 korting op SkinVault Pro</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center"><p className="text-sm text-white/70 uppercase tracking-wider">Normale Prijs</p><p className="text-2xl font-black text-white line-through">€9.99</p></div>
              <div className="text-3xl text-white">→</div>
              <div className="text-center"><p className="text-sm text-white/70 uppercase tracking-wider">Nu</p><p className="text-3xl font-black text-gray-200">€7.99</p></div>
            </div>
            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-gray-200" /><span>Onbeperkte price trackers</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-gray-200" /><span>Onbeperkte wishlist items</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-gray-200" /><span>Exclusieve Pro features</span></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleClaim} disabled={claiming} className="flex-1 bg-white text-gray-700 py-4 rounded-2xl font-black uppercase tracking-wider hover:bg-gray-100 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              {claiming ? <>Bezig...</> : <><Gift size={20} /> Claim Korting</>}
            </button>
            <button onClick={onDismiss} className="px-6 py-4 bg-white/10 text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-white/20 transition-all border border-white/30">Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}
