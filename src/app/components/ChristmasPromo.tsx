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
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);

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
      
      layers.forEach((layer) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        layer.colors.forEach((color, i) => {
          gradient.addColorStop(i / (layer.colors.length - 1), color);
        });

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.8;
        
        for (let band = 0; band < 3; band++) {
          const bandOffset = band * (canvas.width / 3);
          const wavePhase = time * layer.speed + layer.offset + (band * Math.PI / 3);
          
          ctx.beginPath();
          ctx.moveTo(bandOffset, canvas.height);
          
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
          
          ctx.shadowBlur = 30;
          ctx.shadowColor = layer.colors[1];
          ctx.fill();
          ctx.shadowBlur = 0;
        }
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

  // Green screen removal and video processing
  useEffect(() => {
    const video = videoRef.current;
    const videoCanvas = videoCanvasRef.current;
    if (!video || !videoCanvas) return;

    const ctx = videoCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const processFrame = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        if (videoCanvas.width !== video.videoWidth || videoCanvas.height !== video.videoHeight) {
          videoCanvas.width = video.videoWidth;
          videoCanvas.height = video.videoHeight;
        }
        
        ctx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height);
        
        const imageData = ctx.getImageData(0, 0, videoCanvas.width, videoCanvas.height);
        const data = imageData.data;
        
        // Green screen removal (chroma key) - improved algorithm
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Enhanced green screen detection
          // Check if pixel is primarily green
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const greenRatio = g / (r + g + b + 1);
          
          // Green screen is typically bright green: high green, low red/blue
          if (g > 120 && r < 100 && b < 100 && greenRatio > 0.4) {
            // Calculate how "green" the pixel is (0-1)
            const greenness = (g - Math.max(r, b)) / 255;
            
            if (greenness > 0.3) {
              // Make transparent based on greenness for smooth edges
              data[i + 3] = Math.floor(data[i + 3] * (1 - Math.min(greenness * 2, 1)));
            }
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
      
      if (!video.paused && !video.ended) {
        requestAnimationFrame(processFrame);
      }
    };

    video.addEventListener('play', () => {
      processFrame();
    });

    video.addEventListener('loadeddata', () => {
      videoCanvas.width = video.videoWidth;
      videoCanvas.height = video.videoHeight;
    });

    return () => {
      video.removeEventListener('play', processFrame);
    };
  }, []);

  // 3D Animation for video
  useEffect(() => {
    if (!videoRef.current || !santaVisible) return;

    const videoContainer = videoRef.current.parentElement;
    if (!videoContainer) return;

    let frame: number;
    const startTime = Date.now();

    const animate = () => {
      if (throwAttempt === 0) {
        frame = requestAnimationFrame(animate);
        return;
      }

      const elapsed = (Date.now() - startTime) / 1000;
      const progress = (throwAttempt - 1) * 0.33 + (elapsed % 3) / 15; // Smooth progression
      
      // 3D flight path
      const x = -progress * 75;
      const y = progress * 50;
      const z = Math.sin(progress * Math.PI) * 80;
      
      // 3D rotation
      const rotateX = Math.sin(progress * Math.PI * 2) * 12;
      const rotateY = progress * 20;
      const rotateZ = Math.sin(progress * Math.PI * 3) * 8;
      
      // Scale
      const scale = 1 - progress * 0.25;

      videoContainer.style.transform = `
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
    const timer = setTimeout(() => {
      setSantaVisible(true);
      setThrowAttempt(1);
      
      // Start video when visible
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    }, 500);
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
      <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden" style={{ perspective: '2000px' }}>
        {/* Northern Lights Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {/* Video with Green Screen Removal */}
        {santaVisible && (
          <div 
            className="absolute top-[5%] right-[5%] origin-center"
            style={{ 
              width: '50vw',
              maxWidth: '800px',
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
            />
            
            {/* Canvas for chroma key output */}
            <canvas
              ref={videoCanvasRef}
              className="w-full h-full"
              style={{
                objectFit: 'contain',
                filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5)) drop-shadow(0 0 20px rgba(34, 197, 94, 0.3))',
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
