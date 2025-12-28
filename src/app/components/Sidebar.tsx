"use client";
import React, { useEffect, useState } from 'react';
import { Tag, Wallet, User, Search, X, LogOut, Heart, Shield, Menu, Mail, FileText, Sparkles, ShoppingCart, MessageSquare, HelpCircle, Star } from 'lucide-react';
import Link from 'next/link';
import { FaDiscord } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { FaInstagram } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa";	
import { usePathname, useRouter } from 'next/navigation';
import { isOwner } from '@/app/utils/owner-ids';
import ChatPreloader from './ChatPreloader';
import { getUnreadCounts } from '@/app/utils/chat-notifications';

export default function Sidebar({ categories, activeCat, setActiveCat }: any) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [themesDisabled, setThemesDisabled] = useState(false);
  const [hasActiveTheme, setHasActiveTheme] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. Sync User state met LocalStorage & andere tabbladen
  useEffect(() => {
    const checkUser = () => {
      try {
        if (typeof window === 'undefined') return;
        // Test localStorage accessibility first
        const testKey = '__localStorage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);

        const savedUser = window.localStorage.getItem('steam_user');
        setUser(savedUser ? JSON.parse(savedUser) : null);
      } catch {
        // Ignore localStorage errors
        setUser(null);
      }
    };

    checkUser();
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  // Sync theme state (works for logged in and not logged in users)
  useEffect(() => {
    const loadThemeState = async () => {
      try {
        const steamId = user?.steamId || null;

        // Check if there's an active theme from admin (works without login)
        // We check without user preference to see if admin has enabled a theme
        const adminThemeResponse = await fetch('/api/themes/active');
        if (adminThemeResponse.ok) {
          const adminThemeData = await adminThemeResponse.json();
          const themeExists = !!adminThemeData.theme;
          setHasActiveTheme(themeExists);

          if (themeExists) {
            // Check if user has disabled themes
            let userDisabled = false;
            if (steamId) {
              const prefResponse = await fetch(`/api/themes/user-preference?steamId=${steamId}`);
              if (prefResponse.ok) {
                const prefData = await prefResponse.json();
                userDisabled = prefData.disabled || false;
              }
            } else {
              // For non-logged-in users, check localStorage
              try {
                if (typeof window !== 'undefined') {
                  // Test localStorage accessibility first
                  const testKey = '__localStorage_test__';
                  window.localStorage.setItem(testKey, 'test');
                  window.localStorage.removeItem(testKey);
                  userDisabled = window.localStorage.getItem('sv_theme_disabled') === 'true';
                }
              } catch {
                // Ignore localStorage errors - assume theme is enabled
                userDisabled = false;
              }
            }

            setThemesDisabled(userDisabled);
          } else {
            setThemesDisabled(false);
          }
        }
      } catch (error) {
        console.error('Failed to load theme state:', error);
      }
    };

    loadThemeState();

    const handleThemeChange = () => {
      loadThemeState();
    };

    window.addEventListener('themeChanged', handleThemeChange);

    // Poll periodically to catch admin changes
    const interval = setInterval(loadThemeState, 3000);

    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      clearInterval(interval);
    };
  }, [user?.steamId]);

  // Update unread counts
  useEffect(() => {
    const updateUnreadCount = () => {
      if (user?.steamId) {
        const counts = getUnreadCounts(user.steamId);
        setUnreadCount(counts.total);
      } else {
        setUnreadCount(0);
      }
    };

    updateUnreadCount();

    // Listen for unread updates
    window.addEventListener('chat-unread-updated', updateUnreadCount);

    // Poll for updates every 2 seconds
    const interval = setInterval(updateUnreadCount, 2000);

    return () => {
      window.removeEventListener('chat-unread-updated', updateUnreadCount);
      clearInterval(interval);
    };
  }, [user?.steamId]);

  const handleToggleTheme = async () => {
    const newValue = !themesDisabled;
    const steamId = user?.steamId;

    try {
      if (steamId) {
        // Logged in user - save to backend
        const response = await fetch('/api/themes/user-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steamId, disabled: newValue }),
        });

        if (response.ok) {
          setThemesDisabled(newValue);
          // Trigger theme update
          window.dispatchEvent(new CustomEvent('themeChanged'));
        }
      } else {
        // Not logged in - save to localStorage
        if (newValue) {
          localStorage.setItem('sv_theme_disabled', 'true');
        } else {
          localStorage.removeItem('sv_theme_disabled');
        }
        setThemesDisabled(newValue);
        // Trigger storage event for other tabs/components
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'sv_theme_disabled',
          newValue: newValue ? 'true' : null,
          storageArea: localStorage,
        }));
        // Trigger theme update
        window.dispatchEvent(new CustomEvent('themeChanged'));
      }
    } catch (error) {
      console.error('Failed to update theme preference:', error);
    }
  };

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
      <ChatPreloader />
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
          <nav
            aria-label="Main navigation"
            className="w-80 bg-[#0f111a] border-r border-white/5 flex flex-col p-6 overflow-y-auto h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-black text-blue-500 italic uppercase tracking-tighter">SkinVaults</h1>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.3em] mt-1">Premium Analytics</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-500 hover:text-white"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 mb-10 flex-1">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="Market">
                <Tag size={16} /> Market
              </Link>
              <Link href={user?.steamId ? `/inventory?steamId=${user.steamId}` : '/inventory'} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/inventory' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="My Vault">
                <Wallet size={16} /> My Vault
              </Link>
              <Link href="/wishlist" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/wishlist' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="Wishlist">
                <Heart size={16} /> Wishlist
              </Link>
              <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className={`relative flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/chat' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="Chat">
                <MessageSquare size={16} /> Chat
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
              <button
                onClick={() => {
                  setIsSearchOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 hover:text-blue-500 transition-all text-left"
                aria-label="Search Player"
              >
                <Search size={16} /> Search Player
              </button>
              <Link href="/pro" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/pro' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-indigo-400 hover:text-indigo-300'}`} aria-label="Pro Subscription">
                <Shield size={16} /> Pro
              </Link>
              <Link href="/shop" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/shop' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-blue-400 hover:text-blue-300'}`} aria-label="Shop">
                <ShoppingCart size={16} /> Shop
              </Link>
              <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/contact' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="Contact">
                <Mail size={16} /> Contact
              </Link>
              {isOwner(user?.steamId) && (
                <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/admin' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-emerald-400 hover:text-emerald-300'}`}>
                  <Shield size={16} /> Admin Panel
                </Link>
              )}

              {pathname === '/' && categories && (
                <div className="mt-8 pt-8 border-t border-white/5">
                  <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-4">Weapon Categories</h2>
                  <nav className="space-y-1">
                    {categories.map((cat: any) => (
                      <button
                        key={cat.name}
                        onClick={() => { setActiveCat(cat); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-4 px-5 py-3 min-h-[44px] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeCat?.name === cat.name ? 'text-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}
                        aria-label={`Filter by ${cat.name}`}
                      >
                        {cat.icon} {cat.name}
                      </button>
                    ))}
                  </nav>
                </div>
              )}
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
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
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-1 text-[8px] font-black text-red-500 uppercase hover:text-white transition-colors"
                      >
                        <LogOut size={8} /> Logout Session
                      </button>
                      {hasActiveTheme && (
                        <button
                          onClick={handleToggleTheme}
                          className={`flex items-center gap-1 text-[8px] font-black uppercase transition-colors ${!themesDisabled
                              ? 'text-purple-400 hover:text-purple-300'
                              : 'text-gray-500 hover:text-gray-400'
                            }`}
                          title={!themesDisabled ? 'Disable Theme' : 'Enable Theme'}
                        >
                          <Sparkles size={8} className={!themesDisabled ? 'fill-purple-400' : ''} />
                          {!themesDisabled ? 'Theme ON' : 'Theme OFF'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {hasActiveTheme && (
                    <button
                      onClick={handleToggleTheme}
                      className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase transition-all ${!themesDisabled
                          ? 'bg-purple-600/20 border border-purple-500/40 text-purple-400 hover:bg-purple-600/30'
                          : 'bg-[#11141d] border border-white/5 text-gray-500 hover:text-white'
                        }`}
                      title={!themesDisabled ? 'Disable Theme' : 'Enable Theme'}
                    >
                      <Sparkles size={16} className={!themesDisabled ? 'fill-purple-400' : ''} />
                      {!themesDisabled ? 'Theme ON' : 'Theme OFF'}
                    </button>
                  )}
                  <button
                    onClick={handleSteamLogin}
                    className="w-full flex items-center gap-4 p-5 bg-[#11141d] rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all text-gray-500 hover:text-white group"
                  >
                    <div className="bg-white/5 p-2 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                      <User size={18} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest">Sign In with Steam</p>
                  </button>
                </div>
              )}

              {/* Footer Links */}
              {/* Social Media Links */}
              <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                <a
                  href="https://x.com/Skinvaults"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 hover:text-blue-400 uppercase transition-colors"
                >
                  <FontAwesomeIcon icon={faXTwitter} className="text-[10px]" />                  X
                </a>
                <a
                  href="https://discord.gg/bGqf8bBhy5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 hover:text-blue-400 uppercase transition-colors"
                >
                  <FaDiscord size={10} />
                  Discord
                </a>
                <a
                  href="https://www.instagram.com/skinvaults"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 hover:text-blue-400 uppercase transition-colors"
                >
                  <FaInstagram size={10} />
                  Instagram
                </a>
                <a
                  href="https://www.tiktok.com/@skinvaults"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 hover:text-blue-400 uppercase transition-colors"
                >
                  <FaTiktok size={10} />
                  Tiktok
                </a>
              </div>

              {/* Footer Links */}
              <div className="space-y-2 pt-4 border-t border-white/5">
                <div className="flex flex-wrap items-center gap-3 px-2">
                  <Link
                    href="/terms"
                    className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <FileText size={10} />
                    Terms
                  </Link>
                  <Link
                    href="/privacy"
                    className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Shield size={10} />
                    Privacy
                  </Link>
                  <Link
                    href="/faq"
                    className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <HelpCircle size={10} />
                    FAQ
                  </Link>
                  <Link
                    href="/reviews"
                    className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Star size={10} />
                    Reviews
                  </Link>
                </div>
                <div className="text-[8px] font-black uppercase tracking-widest text-gray-400 px-2">
                  © {new Date().getFullYear()} SkinVault. All rights reserved.
                </div>
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <nav aria-label="Main navigation" className="w-80 bg-[#0f111a] border-r border-white/5 hidden lg:flex flex-col p-8 overflow-y-auto shrink-0">
        <div className="mb-12 px-4">
          <h1 className="text-3xl font-black text-blue-500 italic uppercase tracking-tighter">SkinVaults</h1>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mt-1">Premium Analytics</p>
        </div>

        <div className="space-y-2 mb-10 flex-1">
          <Link href="/" className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="Market">
            <Tag size={16} /> Market
          </Link>
          <Link
            href={user?.steamId ? `/inventory?steamId=${user.steamId}` : '/inventory'}
            className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/inventory' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`}
            aria-label="My Vault"
          >
            <Wallet size={16} /> My Vault
          </Link>
          <Link href="/wishlist" className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/wishlist' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="Wishlist">
            <Heart size={16} /> Wishlist
          </Link>
          <Link href="/chat" className={`relative flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/chat' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="Chat">
            <MessageSquare size={16} /> Chat
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 hover:text-blue-500 transition-all text-left"
            aria-label="Search Player"
          >
            <Search size={16} /> Search Player
          </button>
          <Link href="/pro" className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/pro' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-indigo-400 hover:text-indigo-300'}`} aria-label="Pro Subscription">
            <Shield size={16} /> Pro
          </Link>
          <Link href="/shop" className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/shop' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-blue-400 hover:text-blue-300'}`} aria-label="Shop">
            <ShoppingCart size={16} /> Shop
          </Link>
          <Link href="/contact" className={`flex items-center gap-4 px-6 py-4 min-h-[44px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/contact' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`} aria-label="Contact">
            <Mail size={16} /> Contact
          </Link>
          {isOwner(user?.steamId) && (
            <Link href="/admin" className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${pathname === '/admin' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-emerald-400 hover:text-emerald-300'}`}>
              <Shield size={16} /> Admin Panel
            </Link>
          )}

          {pathname === '/' && categories && (
            <div className="mt-8 pt-8 border-t border-white/5">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-4">Weapon Categories</h2>
              <nav className="space-y-1">
                {categories.map((cat: any) => (
                  <button
                    key={cat.name}
                    onClick={() => setActiveCat(cat)}
                    className={`w-full flex items-center gap-4 px-5 py-3 min-h-[44px] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeCat?.name === cat.name ? 'text-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}
                    aria-label={`Filter by ${cat.name}`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
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
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-[8px] font-black text-red-500 uppercase hover:text-white transition-colors"
                  >
                    <LogOut size={8} /> Logout Session
                  </button>
                  {hasActiveTheme && (
                    <button
                      onClick={handleToggleTheme}
                      className={`flex items-center gap-1 text-[8px] font-black uppercase transition-colors ${!themesDisabled
                          ? 'text-purple-400 hover:text-purple-300'
                          : 'text-gray-500 hover:text-gray-400'
                        }`}
                      title={!themesDisabled ? 'Disable Theme' : 'Enable Theme'}
                    >
                      <Sparkles size={8} className={!themesDisabled ? 'fill-purple-400' : ''} />
                      {!themesDisabled ? 'Theme ON' : 'Theme OFF'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {hasActiveTheme && (
                <button
                  onClick={handleToggleTheme}
                  className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase transition-all ${!themesDisabled
                      ? 'bg-purple-600/20 border border-purple-500/40 text-purple-400 hover:bg-purple-600/30'
                      : 'bg-[#11141d] border border-white/5 text-gray-500 hover:text-white'
                    }`}
                  title={!themesDisabled ? 'Disable Theme' : 'Enable Theme'}
                >
                  <Sparkles size={16} className={!themesDisabled ? 'fill-purple-400' : ''} />
                  {!themesDisabled ? 'Theme ON' : 'Theme OFF'}
                </button>
              )}
              <button
                onClick={handleSteamLogin}
                className="w-full flex items-center gap-4 p-5 bg-[#11141d] rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all text-gray-500 hover:text-white group"
              >
                <div className="bg-white/5 p-2 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                  <User size={18} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest">Sign In with Steam</p>
              </button>
            </div>
          )}

          {/* Social Media Links - Show for all users */}
          <div className="flex items-center gap-2 pt-3 border-t border-white/5">
            <a
              href="https://x.com/Skinvaults"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 hover:text-blue-400 uppercase transition-colors"
              title="Follow us on X (Twitter)"
            >
              <FontAwesomeIcon icon={faXTwitter} className="text-[10px]" />              X
            </a>
            <a
              href="https://discord.gg/bGqf8bBhy5"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 hover:text-blue-400 uppercase transition-colors"
            >
              <FaDiscord size={10} />
              Discord
            </a>
            <a
              href="https://www.instagram.com/skinvaults"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 hover:text-blue-400 uppercase transition-colors"
            >
              <FaInstagram size={10} />
              Instagram
            </a>
            <a
              href="https://www.tiktok.com/@skinvaults"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 hover:text-blue-400 uppercase transition-colors"
            >
              <FaTiktok size={10} />
              Tiktok
            </a>
          </div>

          {/* Footer Links */}
          <div className="space-y-2 pt-4 border-t border-white/5">
            <div className="flex flex-wrap items-center gap-3 px-2">
              <Link
                href="/terms"
                className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
              >
                <FileText size={10} />
                Terms
              </Link>
              <Link
                href="/privacy"
                className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Shield size={10} />
                Privacy
              </Link>
              <Link
                href="/faq"
                className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
              >
                <HelpCircle size={10} />
                FAQ
              </Link>
              <Link
                href="/reviews"
                className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Star size={10} />
                Reviews
              </Link>
            </div>
            <div className="text-[8px] font-black uppercase tracking-widest text-gray-400 px-2">
              © {new Date().getFullYear()} SkinVault. All rights reserved.
            </div>
          </div>
        </div>
      </nav>

      {/* --- SEARCH MODAL --- */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#11141d] border border-white/10 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setIsSearchOpen(false)} className="absolute top-4 md:top-8 right-4 md:right-8 text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
            <h2 className="text-2xl md:text-3xl font-black italic uppercase mb-2 tracking-tighter">Stalk Profile</h2>
            <p className="text-[9px] md:text-[10px] text-gray-500 uppercase font-black mb-6 md:mb-8 tracking-[0.2em]">Enter a SteamID64 to see stats and vault</p>
            <form onSubmit={handleSearch} className="space-y-3 md:space-y-4">
              <label htmlFor="sidebar-steam-search" className="sr-only">Steam ID search</label>
              <input
                id="sidebar-steam-search"
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
