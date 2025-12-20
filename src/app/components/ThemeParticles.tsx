"use client";

import { useEffect, useRef } from 'react';
import { ThemeType } from '@/app/utils/theme-storage';

interface ThemeParticlesProps {
  theme: ThemeType;
}

const THEME_PARTICLES: Record<ThemeType, string[]> = {
  christmas: ['❄', '❅', '❆'],
  halloween: ['🎃', '👻', '🦇'],
  easter: ['🥚', '🐰', '🌸'],
  sinterklaas: ['🎅', '⭐', '🎁'],
  newyear: ['✨', '🎆', '🎉'],
  oldyear: ['•', '◦', '○'],
};

const THEME_COLORS: Record<ThemeType, string[]> = {
  christmas: ['rgba(255, 255, 255, 0.9)'],
  halloween: ['rgba(255, 165, 0, 0.7)', 'rgba(139, 0, 255, 0.7)'],
  easter: ['rgba(255, 179, 217, 0.8)', 'rgba(179, 217, 255, 0.8)', 'rgba(255, 244, 179, 0.8)'],
  sinterklaas: ['rgba(220, 20, 60, 0.8)'],
  newyear: ['rgba(255, 215, 0, 0.9)', 'rgba(192, 192, 192, 0.8)'],
  oldyear: ['rgba(169, 169, 169, 0.6)'],
};

const THEME_CONTAINER_CLASSES: Record<ThemeType, string> = {
  christmas: 'christmas-snow-container',
  halloween: 'halloween-particles-container',
  easter: 'easter-particles-container',
  sinterklaas: 'sinterklaas-particles-container',
  newyear: 'newyear-particles-container',
  oldyear: 'oldyear-particles-container',
};

const THEME_PARTICLE_CLASSES: Record<ThemeType, string> = {
  christmas: 'christmas-snowflake',
  halloween: 'halloween-particle',
  easter: 'easter-particle',
  sinterklaas: 'sinterklaas-particle',
  newyear: 'newyear-particle',
  oldyear: 'oldyear-particle',
};

export default function ThemeParticles({ theme }: ThemeParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const particles = THEME_PARTICLES[theme] || ['•'];
    const particleCount = 50;

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = THEME_PARTICLE_CLASSES[theme];
      particle.textContent = particles[Math.floor(Math.random() * particles.length)];
      
      // Random starting position
      particle.style.left = `${Math.random() * 100}%`;
      
      // Random animation duration (8-15 seconds)
      const duration = 8 + Math.random() * 7;
      particle.style.setProperty('--snow-duration', `${duration}s`);
      particle.style.animationDuration = `${duration}s`;
      
      // Random drift (-50px to 50px)
      const drift = -50 + Math.random() * 100;
      particle.style.setProperty('--snow-drift', `${drift}px`);
      particle.style.setProperty('--particle-drift', `${drift}px`);
      particle.style.setProperty('--easter-drift', `${drift}px`);
      particle.style.setProperty('--sinterklaas-drift', `${drift}px`);
      particle.style.setProperty('--newyear-drift', `${drift}px`);
      particle.style.setProperty('--oldyear-drift', `${drift}px`);
      
      // Random size
      const size = theme === 'oldyear' ? 0.3 + Math.random() * 0.4 : 0.5 + Math.random() * 0.7;
      particle.style.fontSize = `${size}em`;
      
      // Random delay
      particle.style.animationDelay = `${Math.random() * duration}s`;
      
      // Random opacity
      particle.style.opacity = `${0.2 + Math.random() * 0.6}`;
      
      // Set color for Easter theme
      if (theme === 'easter' && THEME_COLORS[theme]) {
        const colors = THEME_COLORS[theme];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.color = color;
      }
      
      container.appendChild(particle);
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [theme]);

  return <div ref={containerRef} className={THEME_CONTAINER_CLASSES[theme]} />;
}

