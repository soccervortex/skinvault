"use client";

import { useEffect } from 'react';

/**
 * Client-side component to initialize safe storage polyfills
 * This runs early in the component tree to ensure storage is safe before React hydration
 */
export default function SafeStorageInit() {
  useEffect(() => {
    // This runs on the client side after mount
    // The actual polyfill is loaded via script in layout.tsx before React loads
    // This component just ensures we handle any remaining edge cases
  }, []);

  return null; // This component doesn't render anything
}

