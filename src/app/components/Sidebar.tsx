"use client";
import React, { useEffect, useState } from 'react';
import { Tag, Wallet, User, Search, X, LogOut, Heart, Shield, Menu, Mail } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const OWNER_STEAM_ID = '76561199235618867';

export default function Sidebar({ categories, activeCat, setActiveCat }: any) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 1. Sync User state met LocalStorage & andere tabbladen
  useEffect(() => {
    const checkUser = () => {
      const savedUser = localStorage.getItem('steam_user');
      setUser(savedUser ? JSON.parse(savedUser) : null);
    };

    checkUser();
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  // 2. Steam Login Handler
  const handleSteamLogin = () => {
    // Delegate OpenID URL building to backend route so host/protocol are always correct
    window.location.href = '/api/auth/steam';
  };

  // 3. Logout Handler (Zorgt voor directe UI update)
  const handleLogout = () => {
    localStorage.removeItem('steam_user');
    localStorage.removeItem('user_inventory');
    setUser(null);
    window.location.href = '/'; // Reset de gehele app state
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId) {
      // Use 'steamId' parameter for searches, not 'openid.claimed_id' 
      // to avoid being treated as a login callback
      router.push(`/inventory?steamId=${searchId}`);
      setIsSearchOpen(false);
      setSearchId("");
    }
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-[#11141d] rounded-2xl border border-white/10 text-white hover:bg-[#0f111a] transition-all"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <aside 
            className="w-80 bg-[#0f111a] border-r border-white/5 flex flex-col p-6 overflow-y-auto h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-black text-blue-500 italic uppercase tracking-tighter">SkinVault</h1>
                <p className="text-[8px] font-black text-gray-600 uppercase tracking-[0.3em] mt-1">Premium Analytics</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2 mb-10 flex-1">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
                <Tag size={16}/> Market
              </Link>
              <Link href={user?.steamId ? `/inventory?steamId=${user.steamId}` : '/inventory'} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/inventory' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
                <Wallet size={16}/> My Vault
              </Link>
              <Link href="/wishlist" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/wishlist' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
                <Heart size={16}/> Wishlist
              </Link>
              <Link href="/pro" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/pro' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-indigo-400 hover:text-indigo-300'}`}>
                <Shield size={16}/> Pro
              </Link>
              <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/contact' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
                <Mail size={16}/> Contact
              </Link>
              {user?.steamId === OWNER_STEAM_ID && (
                <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/admin' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-emerald-400 hover:text-emerald-300'}`}>
                  <Shield size={16}/> Admin Panel
                </Link>
              )}
              <button 
                onClick={() => {
                  setIsSearchOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 hover:text-blue-500 transition-all text-left"
              >
                <Search size={16}/> Search Player
              </button>

              {pathname === '/' && categories && (
                <div className="mt-8 pt-8 border-t border-white/5">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-4">Weapon Categories</h3>
                  <nav className="space-y-1">
                    {categories.map((cat: any) => (
                      <button key={cat.name} onClick={() => { setActiveCat(cat); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeCat?.name === cat.name ? 'text-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}>
                        {cat.icon} {cat.name}
                      </button>
                    ))}
                  </nav>
                </div>
              )}
            </div>

            <div className="mt-auto pt-6 border-t border-white/5">
              {user ? (
                <div className="bg-[#11141d] p-4 rounded-[2rem] border border-white/5 flex items-center gap-4 group">
                  <img src={user.avatar} className="w-10 h-10 rounded-full border border-blue-500/50" alt="Avatar" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest truncate">
                        {user.name}
                      </p>
                      {user.proUntil && new Date(user.proUntil) > new Date() && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[8px] font-black uppercase tracking-widest text-emerald-400 shrink-0">
                          Pro
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={handleLogout} 
                      className="flex items-center gap-1 text-[8px] font-black text-red-500 uppercase hover:text-white transition-colors"
                    >
                      <LogOut size={8} /> Logout Session
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleSteamLogin}
                  className="w-full flex items-center gap-4 p-5 bg-[#11141d] rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all text-gray-500 hover:text-white group"
                >
                  <div className="bg-white/5 p-2 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <User size={18} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Sign In with Steam</p>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-80 bg-[#0f111a] border-r border-white/5 hidden lg:flex flex-col p-8 overflow-y-auto shrink-0">
        <div className="mb-12 px-4">
          <h1 className="text-3xl font-black text-blue-500 italic uppercase tracking-tighter">SkinVault</h1>
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mt-1">Premium Analytics</p>
        </div>
        
        <div className="space-y-2 mb-10 flex-1">
          <Link href="/" className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
            <Tag size={16}/> Market
          </Link>
          <Link 
            href={user?.steamId ? `/inventory?steamId=${user.steamId}` : '/inventory'} 
            className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/inventory' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
          >
            <Wallet size={16}/> My Vault
          </Link>
          <Link href="/wishlist" className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/wishlist' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
            <Heart size={16}/> Wishlist
          </Link>
          <Link href="/pro" className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/pro' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-gray-500 hover:text-indigo-300'}`}>
            <Shield size={16}/> Pro
          </Link>
          {user?.steamId === OWNER_STEAM_ID && (
            <Link href="/admin" className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/admin' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-emerald-400 hover:text-emerald-300'}`}>
              <Shield size={16}/> Admin Panel
            </Link>
          )}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 hover:text-blue-500 transition-all text-left"
          >
            <Search size={16}/> Search Player
          </button>

          {pathname === '/' && categories && (
            <div className="mt-8 pt-8 border-t border-white/5">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-4">Weapon Categories</h3>
              <nav className="space-y-1">
                {categories.map((cat: any) => (
                  <button key={cat.name} onClick={() => setActiveCat(cat)} className={`w-full flex items-center gap-4 px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeCat?.name === cat.name ? 'text-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}>
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-white/5">
          {user ? (
            <div className="bg-[#11141d] p-4 rounded-[2rem] border border-white/5 flex items-center gap-4 group">
              <img src={user.avatar} className="w-10 h-10 rounded-full border border-blue-500/50" alt="Avatar" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest truncate">
                    {user.name}
                  </p>
                  {user.proUntil && new Date(user.proUntil) > new Date() && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[8px] font-black uppercase tracking-widest text-emerald-400 shrink-0">
                      Pro
                    </span>
                  )}
                </div>
                <button 
                  onClick={handleLogout} 
                  className="flex items-center gap-1 text-[8px] font-black text-red-500 uppercase hover:text-white transition-colors"
                >
                  <LogOut size={8} /> Logout Session
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleSteamLogin}
              className="w-full flex items-center gap-4 p-5 bg-[#11141d] rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all text-gray-500 hover:text-white group"
            >
              <div className="bg-white/5 p-2 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <User size={18} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest">Sign In with Steam</p>
            </button>
          )}
        </div>
      </aside>

      {/* --- SEARCH MODAL --- */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#11141d] border border-white/10 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setIsSearchOpen(false)} className="absolute top-4 md:top-8 right-4 md:right-8 text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
            <h2 className="text-2xl md:text-3xl font-black italic uppercase mb-2 tracking-tighter">Stalk Profile</h2>
            <p className="text-[9px] md:text-[10px] text-gray-500 uppercase font-black mb-6 md:mb-8 tracking-[0.2em]">Enter a SteamID64 to see stats and vault</p>
            <form onSubmit={handleSearch} className="space-y-3 md:space-y-4">
              <input 
                autoFocus
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="e.g. 76561199235618867"
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-4 md:py-5 px-6 md:px-8 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-800"
              />
              <button type="submit" className="w-full bg-blue-600 py-4 md:py-5 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20">Analyze Combat Record</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}