import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-lg bg-[#11141d] border border-blue-500/30 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl text-center space-y-4 md:space-y-6">
        <div className="flex justify-center">
          <div className="p-3 md:p-4 rounded-full bg-blue-500/10 border border-blue-500/40">
            <Search className="text-blue-400" size={40} />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
          404 - Page Not Found
        </h1>
        <p className="text-[10px] md:text-[11px] text-gray-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <Link
            href="/"
            className="bg-blue-600 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
          >
            <Home size={14} />
            Go Home
          </Link>
          <Link
            href="/inventory"
            className="bg-black/40 border border-white/10 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <Search size={14} />
            Browse Skins
          </Link>
        </div>
      </div>
    </div>
  );
}

