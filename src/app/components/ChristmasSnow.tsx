"use client";

import { useEffect, useRef } from 'react';

export default function ChristmasSnow() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const snowflakes: string[] = ['❄', '❅', '❆'];
    const snowflakeCount = 50;

    // Create snowflakes
    for (let i = 0; i < snowflakeCount; i++) {
      const snowflake = document.createElement('div');
      snowflake.className = 'christmas-snowflake';
      snowflake.textContent = snowflakes[Math.floor(Math.random() * snowflakes.length)];
      
      // Random starting position
      snowflake.style.left = `${Math.random() * 100}%`;
      
      // Random animation duration (8-15 seconds)
      const duration = 8 + Math.random() * 7;
      snowflake.style.setProperty('--snow-duration', `${duration}s`);
      
      // Random drift (-50px to 50px)
      const drift = -50 + Math.random() * 100;
      snowflake.style.setProperty('--snow-drift', `${drift}px`);
      
      // Random size (0.5em to 1.2em)
      snowflake.style.fontSize = `${0.5 + Math.random() * 0.7}em`;
      
      // Random delay
      snowflake.style.animationDelay = `${Math.random() * duration}s`;
      
      // Random opacity
      snowflake.style.opacity = `${0.3 + Math.random() * 0.5}`;
      
      container.appendChild(snowflake);
    }

    return () => {
      // Cleanup
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return <div ref={containerRef} className="christmas-snow-container" />;
}

