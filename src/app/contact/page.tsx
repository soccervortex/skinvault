"use client";

import React, { useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { Mail, Copy, Check, MessageSquare } from 'lucide-react';
import { copyToClipboard } from '@/app/utils/clipboard';

export default function ContactPage() {
  const [copied, setCopied] = useState(false);

  const contactEmail = 'contact@skinvaults.online';
  const discordInvite = 'https://discord.gg/bGqf8bBhy5';
  
  const exampleTemplate = `Subject: [Reason] - [Your Name]

Reason: Payment Related / Site Related / Bug Report / Feature Request / Pro Subscription / Account Issue / Other

Name: Your Name
Email: your@email.com

Description:
[Describe your issue or inquiry in detail here]

[If applicable, attach screenshots/images]`;

  const handleCopyEmail = async () => {
    const ok = await copyToClipboard(contactEmail);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyTemplate = async () => {
    const ok = await copyToClipboard(exampleTemplate);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8 pb-32">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
                <Mail className="text-blue-400" size={24} />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                  Contact Us
                </h1>
                <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                  How to reach us
                </p>
              </div>
            </div>
          </header>

          <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6 md:space-y-8">
            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                Contact Email
              </h2>
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 flex items-center justify-between gap-4">
                <code className="text-[11px] md:text-[12px] text-blue-400 font-mono break-all">
                  {contactEmail}
                </code>
                <button
                  onClick={handleCopyEmail}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                Discord Server
              </h2>
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 flex items-center justify-between gap-4">
                <code className="text-[11px] md:text-[12px] text-blue-400 font-mono break-all">
                  {discordInvite}
                </code>
                <a
                  href={discordInvite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0"
                >
                  <MessageSquare size={14} />
                  Join
                </a>
              </div>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                How to Contact Us
              </h2>
              <p className="text-[11px] md:text-[12px] text-gray-300 mb-4 leading-relaxed">
                Send us an email using the template below. Include all relevant information to help us assist you quickly.
              </p>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter text-blue-400">
                  Email Template
                </h2>
                <button
                  onClick={handleCopyTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Template'}
                </button>
              </div>
              
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
                <pre className="text-[10px] md:text-[11px] text-gray-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
{exampleTemplate}
                </pre>
              </div>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                What to Include
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div>
                    <p className="text-[11px] md:text-[12px] font-black text-white mb-1">Reason for Contact</p>
                    <p className="text-[10px] md:text-[11px] text-gray-400">
                      Payment Related, Site Related, Bug Report, Feature Request, Pro Subscription, Account Issue, or Other
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div>
                    <p className="text-[11px] md:text-[12px] font-black text-white mb-1">Your Name</p>
                    <p className="text-[10px] md:text-[11px] text-gray-400">
                      So we know how to address you
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div>
                    <p className="text-[11px] md:text-[12px] font-black text-white mb-1">Your Email</p>
                    <p className="text-[10px] md:text-[11px] text-gray-400">
                      Where we can reach you for a response
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div>
                    <p className="text-[11px] md:text-[12px] font-black text-white mb-1">Detailed Description</p>
                    <p className="text-[10px] md:text-[11px] text-gray-400">
                      Explain your issue or inquiry in detail. The more information, the better we can help.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div>
                    <p className="text-[11px] md:text-[12px] font-black text-white mb-1">Screenshots/Images (Optional)</p>
                    <p className="text-[10px] md:text-[11px] text-gray-400">
                      Attach images if they help explain your issue (max 5 images)
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-blue-500/10 border border-blue-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
              <p className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed">
                <strong className="text-blue-400">Note:</strong> We typically respond within 24-48 hours. For urgent payment or account issues, please include "URGENT" in your subject line.
              </p>
            </section>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
