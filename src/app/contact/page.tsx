"use client";

import React, { useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { Mail, Send, Upload, X, Loader2 } from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    reason: '',
    name: '',
    email: '',
    description: '',
  });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = [...images, ...files].slice(0, 5); // Max 5 images
    setImages(newImages);
    
    // Create previews
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    setPreviews(newPreviews);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setImages(newImages);
    setPreviews(newPreviews);
    // Revoke object URLs to free memory
    URL.revokeObjectURL(previews[index]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.reason || !formData.name || !formData.email || !formData.description) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('reason', formData.reason);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('description', formData.description);
      
      images.forEach((image, index) => {
        formDataToSend.append(`image_${index}`, image);
      });

      const response = await fetch('/api/contact', {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSubmitted(true);
      setFormData({ reason: '', name: '', email: '', description: '' });
      setImages([]);
      setPreviews.forEach(url => URL.revokeObjectURL(url));
      setPreviews([]);
    } catch (err: any) {
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar flex items-center justify-center">
          <div className="w-full max-w-2xl bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl text-center space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 inline-flex mx-auto">
              <Mail className="text-emerald-400" size={32} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
              Message Sent!
            </h1>
            <p className="text-[11px] md:text-[12px] text-gray-400">
              Thank you for contacting us. We'll get back to you as soon as possible.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="bg-blue-600 hover:bg-blue-500 text-white py-3 px-6 rounded-xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all"
            >
              Send Another Message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
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
                  We're here to help
                </p>
              </div>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6 md:space-y-8">
            {error && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 text-[11px] text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500">
                Reason for Contact *
              </label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                required
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-[11px] md:text-[12px] outline-none focus:border-blue-500/50 transition-all"
              >
                <option value="">Select a reason...</option>
                <option value="payment">Payment Related</option>
                <option value="site">Site Related</option>
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="pro">Pro Subscription</option>
                <option value="account">Account Issue</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-[11px] md:text-[12px] outline-none focus:border-blue-500/50 transition-all"
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-[11px] md:text-[12px] outline-none focus:border-blue-500/50 transition-all"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={6}
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-[11px] md:text-[12px] outline-none focus:border-blue-500/50 transition-all resize-none"
                placeholder="Tell us more about your inquiry..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <Upload size={14} />
                Images (Optional, max 5)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-[10px] md:text-[11px] outline-none focus:border-blue-500/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-500"
              />
              
              {previews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-4">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 md:h-32 object-cover rounded-xl border border-white/10"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white py-4 md:py-5 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-blue-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send Message
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

