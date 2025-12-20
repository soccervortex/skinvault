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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Green screen removal with canvas
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const processFrame = () => {
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Remove green screen (chroma key)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Detect green screen pixels
          const greenRatio = g / (r + g + b + 1);
          if (g > 100 && r < 100 && b < 100 && greenRatio > 0.4) {
            const greenness = (g - Math.max(r, b)) / 255;
            if (greenness > 0.2) {
              data[i + 3] = Math.floor(data[i + 3] * (1 - Math.min(greenness * 2.5, 1)));
            }
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
      
      if (!video.paused && !video.ended) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    const handlePlay = () => {
      processFrame();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('loadeddata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    });

    return () => {
      video.removeEventListener('play', handlePlay);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Start video when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setSantaVisible(true);
      setThrowAttempt(1);
      
      // Start video
      if (videoRef.current) {
        videoRef.current.play().catch((err) => {
          console.error('Video play error:', err);
        });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // 3D Animation for video container
  useEffect(() => {
    if (!containerRef.current || !santaVisible) return;

    const container = containerRef.current;
    let frame: number;
    const startTime = Date.now();

    const animate = () => {
      if (throwAttempt === 0) {
        frame = requestAnimationFrame(animate);
        return;
      }

      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min((throwAttempt - 1) * 0.33 + (elapsed % 3) / 10, 1);
      
      // 3D flight path
      const x = -progress * 70;
      const y = progress * 45;
      const z = Math.sin(progress * Math.PI) * 60;
      
      // 3D rotation
      const rotateX = Math.sin(progress * Math.PI * 2) * 10;
      const rotateY = progress * 18;
      const rotateZ = Math.sin(progress * Math.PI * 3) * 6;
      
      // Scale
      const scale = 1 - progress * 0.2;

      container.style.transform = `
        translate3d(${x}vw, ${y}vh, ${z}px)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
        rotateZ(${rotateZ}deg)
        scale(${scale})
      `;

      frame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [santaVisible, throwAttempt]);

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
      <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden" style={{ perspective: '2000px', background: 'transparent' }}>
        {/* Video with Green Screen Removal */}
        {santaVisible && (
          <div 
            ref={containerRef}
            className="absolute top-[10%] right-[5%] origin-center"
            style={{ 
              width: '60vw',
              maxWidth: '900px',
              aspectRatio: '16/9',
              zIndex: 10001,
              transformStyle: 'preserve-3d',
              willChange: 'transform'
            }}
          >
            {/* Hidden video for processing */}
            <video
              ref={videoRef}
              src="/santa-sleigh-green.mp4"
              loop
              muted
              playsInline
              className="hidden"
              style={{ display: 'none' }}
            />
            
            {/* Canvas showing video with green screen removed */}
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain"
              style={{
                filter: 'drop-shadow(0 10px 40px rgba(0,0,0,0.8))',
                imageRendering: 'auto'
              }}
            />
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
