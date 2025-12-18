"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, Swords, Info, Shield, Target, Zap, Award } from 'lucide-react';
import Link from 'next/link';

function CompareContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id1 = searchParams.get('id1');
    const id2 = searchParams.get('id2');
    
    fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json')
      .then(res => res.json())
      .then(data => {
        const found = [
          data.find((i: any) => i.id === id1),
          data.find((i: any) => i.id === id2)
        ].filter(Boolean);
        setItems(found);
        setLoading(false);
      });
  }, [searchParams]);

  if (loading) return <div className="min-h-screen bg-[#08090d] flex items-center justify-center text-blue-500 font-black animate-pulse">INITIATING DUEL...</div>;
  if (items.length < 2) return <div className="min-h-screen bg-[#08090d] flex items-center justify-center text-white">Select two skins to duel.</div>;

  return (
    <div className="min-h-screen bg-[#08090d] text-white overflow-x-hidden relative font-sans">
      {/* Achtergrond effecten */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-[-45deg]" />
      </div>

      <nav className="relative z-10 p-8">
        <Link href="/" className="inline-flex items-center gap-3 text-gray-500 hover:text-white transition-all group">
          <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10"><ChevronLeft size={16}/></div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Abort Mission</span>
        </Link>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-4 bg-white/5 px-6 py-2 rounded-full border border-white/10 mb-6">
            <Swords size={14} className="text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Skin Intelligence Duel</span>
          </div>
          <h1 className="text-7xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Versus</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-8 lg:gap-0">
          
          {/* SKIN LEFT */}
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/5 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="bg-gradient-to-br from-[#11141d] to-[#08090d] border border-white/5 rounded-[4rem] p-10 relative overflow-hidden transition-transform duration-500 hover:scale-[1.02]">
              <div className="absolute top-0 left-0 h-2 w-full" style={{ backgroundColor: items[0].rarity?.color }} />
              <div className="aspect-video flex items-center justify-center mb-10">
                <img src={items[0].image} className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:rotate-[-5deg] transition-transform duration-700" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-2" style={{ color: items[0].rarity?.color }}>{items[0].rarity?.name}</p>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter">{items[0].name}</h2>
            </div>
          </div>

          {/* VS CIRCLE */}
          <div className="flex flex-col items-center justify-center z-20 -mx-4 lg:-mx-8">
            <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center font-black italic text-2xl shadow-[0_0_50px_rgba(255,255,255,0.3)] border-[8px] border-[#08090d]">
              VS
            </div>
          </div>

          {/* SKIN RIGHT */}
          <div className="relative group">
            <div className="absolute inset-0 bg-purple-500/5 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="bg-gradient-to-bl from-[#11141d] to-[#08090d] border border-white/5 rounded-[4rem] p-10 relative overflow-hidden transition-transform duration-500 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 h-2 w-full" style={{ backgroundColor: items[1].rarity?.color }} />
              <div className="aspect-video flex items-center justify-center mb-10">
                <img src={items[1].image} className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:rotate-[5deg] transition-transform duration-700" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-2" style={{ color: items[1].rarity?.color }}>{items[1].rarity?.name}</p>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter">{items[1].name}</h2>
            </div>
          </div>

        </div>

        {/* COMPARISON SPEC TABLE */}
        <div className="mt-20 max-w-4xl mx-auto space-y-4">
          <div className="grid grid-cols-3 px-10 mb-8">
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">{items[0].weapon?.name}</div>
            <div className="text-center text-[10px] font-black uppercase tracking-widest text-gray-600">Metric</div>
            <div className="text-right text-[10px] font-black uppercase tracking-widest text-purple-500">{items[1].weapon?.name}</div>
          </div>

          <DuelRow label="Weapon Type" val1={items[0].category?.name} val2={items[1].category?.name} icon={<Shield size={14}/>} />
          <DuelRow label="Rarity Level" val1={items[0].rarity?.name} val2={items[1].rarity?.name} icon={<Award size={14}/>} />
          <DuelRow label="Collection" val1={items[0].collections?.[0]?.name || "N/A"} val2={items[1].collections?.[0]?.name || "N/A"} icon={<Target size={14}/>} />
          <DuelRow label="Team" val1={items[0].team?.name || "Both"} val2={items[1].team?.name || "Both"} icon={<Zap size={14}/>} />
        </div>
      </div>
    </div>
  );
}

function DuelRow({ label, val1, val2, icon }: any) {
  return (
    <div className="bg-[#11141d] border border-white/5 p-6 rounded-[2rem] grid grid-cols-[1fr_auto_1fr] items-center gap-6">
      <div className="text-sm font-black uppercase italic tracking-tighter text-blue-400">{val1}</div>
      <div className="flex items-center gap-3 px-4 py-2 bg-black/40 rounded-full border border-white/5">
        <span className="text-gray-500">{icon}</span>
        <span className="text-[8px] font-black uppercase text-gray-400 whitespace-nowrap">{label}</span>
      </div>
      <div className="text-right text-sm font-black uppercase italic tracking-tighter text-purple-400">{val2}</div>
    </div>
  );
}

export default function ComparePage() { 
  return (
    <Suspense fallback={null}>
      <CompareContent />
    </Suspense>
  ); 
}