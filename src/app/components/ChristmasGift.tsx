"use client";

import { useState, useEffect } from 'react';
import { Gift, X } from 'lucide-react';

const PROMO_CODE = 'CHRISTMAS2024';
const DISCOUNT_AMOUNT = 2;
const PROMO_STORAGE_KEY = 'sv_christmas_promo_claimed_2024';

export default function ChristmasGift() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if promo has been claimed this year
    if (typeof window === 'undefined') return;
    
    const claimed = localStorage.getItem(PROMO_STORAGE_KEY);
    if (claimed === 'true') {
      setHasClaimed(true);
    }
  }, []);

  const handleGiftClick = () => {
    if (hasClaimed) return;
    
    setShowModal(true);
    setIsOpen(true);
    
    // Mark as claimed
    if (typeof window !== 'undefined') {
      localStorage.setItem(PROMO_STORAGE_KEY, 'true');
      setHasClaimed(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  if (hasClaimed) return null;

  return (
    <>
      {/* 3D Gift Box */}
      <div
        onClick={handleGiftClick}
        className={`fixed bottom-6 right-6 z-[10000] cursor-pointer transition-all duration-500 ${
          isOpen ? 'scale-0 rotate-180' : 'hover:scale-110'
        }`}
        style={{
          animation: isOpen ? 'none' : 'bounce-gift 2s ease-in-out infinite',
        }}
        id="christmas-gift-box"
      >
        <div
          className="relative w-20 h-20"
          style={{
            transformStyle: 'preserve-3d',
            perspective: '1000px',
          }}
        >
          {/* Gift Box - 3D effect */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-500 to-green-600 rounded-lg shadow-2xl"
            style={{
              transform: 'rotateX(15deg) rotateY(15deg)',
              boxShadow: '0 10px 30px rgba(220, 38, 38, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.2)',
            }}
          >
            {/* Gift Ribbon */}
            <div className="absolute top-1/2 left-0 right-0 h-4 bg-yellow-400 transform -translate-y-1/2 shadow-lg"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-4 bg-yellow-400 transform -translate-x-1/2 shadow-lg"></div>
            {/* Bow */}
            <div className="absolute top-1 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-6 h-6 bg-yellow-300 rounded-full shadow-md"></div>
            </div>
          </div>
        </div>
        
        {/* Sparkle effect */}
        <div className="absolute -top-2 -right-2 text-yellow-300 text-2xl animate-pulse">✨</div>
      </div>

      {/* Promo Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-gradient-to-br from-red-600 via-red-500 to-green-600 rounded-3xl p-8 md:p-12 max-w-md w-full shadow-2xl relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center space-y-6">
              {/* Gift Icon */}
              <div className="flex justify-center">
                <div className="p-6 bg-white/20 rounded-full backdrop-blur-sm">
                  <Gift size={48} className="text-white" />
                </div>
              </div>

              {/* Title */}
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">
                  Kerst Special!
                </h2>
                <p className="text-white/90 text-lg">
                  €{DISCOUNT_AMOUNT} korting op je volgende aankoop
                </p>
              </div>

              {/* Promo Code */}
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/30">
                <p className="text-white/80 text-sm uppercase tracking-wider mb-2">Promo Code</p>
                <div className="flex items-center justify-center gap-3">
                  <code className="text-3xl font-black text-white tracking-wider bg-white/10 px-6 py-3 rounded-xl">
                    {PROMO_CODE}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(PROMO_CODE);
                      // Visual feedback could be added here
                    }}
                    className="text-white/80 hover:text-white transition-colors"
                    title="Kopieer code"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Info */}
              <p className="text-white/70 text-sm">
                Gebruik deze code bij checkout om €{DISCOUNT_AMOUNT} korting te krijgen!
              </p>

              <button
                onClick={handleCloseModal}
                className="w-full bg-white text-red-600 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl"
              >
                Geweldig!
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

