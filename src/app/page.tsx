'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, QrCode, Sparkles, ArrowRight, Heart, Download } from 'lucide-react';
import { useLanguage, LanguageToggle } from '@/lib/i18n';

export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [eventCode, setEventCode] = useState('');

  const handleGoToEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = eventCode.trim().toLowerCase();
    if (cleanSlug) {
      router.push(`/g/${cleanSlug}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FAF8F5] text-stone-800 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-100/50 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -left-24 w-80 h-80 rounded-full bg-rose-100/40 blur-3xl" />

      <header className="relative z-10 max-w-5xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-amber-700 fill-amber-700/20" />
          <span
            style={{ fontFamily: 'var(--font-serif)' }}
            className="text-2xl font-semibold tracking-tight text-stone-900"
          >
            Wedding Moments
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-widest text-stone-500 hidden sm:inline">
            Original Quality • Zero App
          </span>
          <LanguageToggle />
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 text-center space-y-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-900/5 border border-amber-900/10 text-amber-900 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            {t.badge}
          </div>

          <h1
            style={{ fontFamily: 'var(--font-serif)' }}
            className="text-4xl sm:text-6xl font-semibold text-stone-900 leading-[1.12] tracking-tight"
          >
            {t.heroTitle}
          </h1>

          <p className="max-w-xl mx-auto text-stone-600 text-base sm:text-lg leading-relaxed">
            {t.heroSubtitle}
          </p>
        </div>

        <form
          onSubmit={handleGoToEvent}
          className="max-w-md mx-auto bg-white/90 backdrop-blur p-2 rounded-2xl shadow-sm border border-stone-200/80 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={t.eventPlaceholder}
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value)}
            className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition shrink-0 cursor-pointer"
          >
            {t.openBtn}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-left">
          <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-stone-200/70 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)' }} className="text-xl font-semibold text-stone-900">
              {t.step1Title}
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">{t.step1Desc}</p>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-stone-200/70 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)' }} className="text-xl font-semibold text-stone-900">
              {t.step2Title}
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">{t.step2Desc}</p>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-stone-200/70 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)' }} className="text-xl font-semibold text-stone-900">
              {t.step3Title}
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">{t.step3Desc}</p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-stone-400">
        {t.footer}
      </footer>
    </div>
  );
}