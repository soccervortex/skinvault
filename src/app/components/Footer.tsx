"use client";

import React from 'react';
import Link from 'next/link';
import { Mail, FileText, Shield } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0f111a] border-t border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            <Link 
              href="/contact" 
              className="flex items-center gap-2 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-blue-400 transition-colors"
            >
              <Mail size={12} />
              Contact
            </Link>
            <Link 
              href="/terms" 
              className="flex items-center gap-2 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-400 transition-colors"
            >
              <FileText size={12} />
              Terms
            </Link>
            <Link 
              href="/privacy" 
              className="flex items-center gap-2 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-400 transition-colors"
            >
              <Shield size={12} />
              Privacy
            </Link>
          </div>

          {/* Copyright */}
          <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-600 text-center md:text-right">
            © {currentYear} SkinVault. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}



