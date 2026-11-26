'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { ChevronLeft, ChevronRight, Play, Pause, X, Expand, Loader2 } from 'lucide-react';

interface MediaItem {
  id: string;
  public_url: string;
  mime_type: string;
  guest_name: string | null;
  wish: string | null;
  taken_at: string;
  is_approved: boolean;
}

function SlideshowContent() {
  const params = useParams();
  const slug = params.slug as string;

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [intervalMs, setIntervalMs] = useState(5000);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      const { data: event } = await supabaseBrowser
        .from('events')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!event) return;

      const { data: mediaData } = await supabaseBrowser
        .from('media')
        .select('*')
        .eq('event_id', event.id)
        .eq('is_approved', true)
        .order('taken_at', { ascending: true });

      setMedia(mediaData || []);
      setLoading(false);
    };

    fetchMedia();
  }, [slug]);

  useEffect(() => {
    if (playing && media.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % media.length);
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, media.length, intervalMs]);

  const currentItem = media[currentIndex];

  const toggleFullscreen = async () => {
    if (!fullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      } catch {}
    } else {
      try {
        await document.exitFullscreen();
        setFullscreen(false);
      } catch {}
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl">Δεν υπάρχουν εγκεκριμένες φωτογραφίες</p>
          <p className="text-stone-300 mt-2">Οι φωτογραφίες εμφανίζονται εδώ μόλις εγκριθούν από το admin panel</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            onClick={() => window.close()}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:ring-2 focus:ring-white focus:outline-none"
            aria-label="Κλείσιμο"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
          <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-sm font-mono">
            {currentIndex + 1} / {media.length}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <label className="text-white/80 text-sm mr-2">Διάστημα:</label>
          <select
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            className="bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm border border-white/20 focus:ring-2 focus:ring-white focus:outline-none"
          >
            <option value={3000}>3s</option>
            <option value={5000}>5s</option>
            <option value={8000}>8s</option>
            <option value={10000}>10s</option>
          </select>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:ring-2 focus:ring-white focus:outline-none"
            aria-label={fullscreen ? 'Έξοδος πλήρης οθόνη' : 'Πλήρης οθόνη'}
          >
            {fullscreen ? <X className="w-6 h-6" aria-hidden="true" /> : <Expand className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Previous */}
        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus:ring-2 focus:ring-white focus:outline-none"
            aria-label="Προηγούμενη"
          >
            <ChevronLeft className="w-8 h-8" aria-hidden="true" />
          </button>
        )}

        {/* Media */}
        <div className="max-w-5xl max-h-[80vh] flex flex-col items-center gap-4 px-4">
          {currentItem?.mime_type.startsWith('video/') ? (
            <video
              ref={videoRef}
              src={currentItem.public_url}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] max-w-full rounded-xl"
              onEnded={() => setCurrentIndex((prev) => (prev + 1) % media.length)}
            />
          ) : (
            <img
              src={currentItem.public_url}
              alt={currentItem.guest_name || 'Slideshow photo'}
              className="max-h-[70vh] max-w-full object-contain rounded-xl"
            />
          )}

          <div className="text-center text-white max-w-2xl">
            <p className="text-lg font-medium">
              {currentItem.guest_name || 'Ανώνυμος καλεσμένος'}
            </p>
            {currentItem.wish && (
              <p className="text-stone-300 italic mt-2 text-base">«{currentItem.wish}»</p>
            )}
          </div>
        </div>

        {/* Next */}
        {currentIndex < media.length - 1 && (
          <button
            onClick={() => setCurrentIndex((prev) => prev + 1)}
            className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus:ring-2 focus:ring-white focus:outline-none"
            aria-label="Επόμενη"
          >
            <ChevronRight className="w-8 h-8" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 p-4 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + media.length) % media.length)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:ring-2 focus:ring-white focus:outline-none"
            aria-label="Προηγούμενη"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>

          <button
            onClick={() => setPlaying(!playing)}
            className="p-3 rounded-full bg-white/20 text-white hover:bg-white/30 focus:ring-2 focus:ring-white focus:outline-none"
            aria-label={playing ? 'Παύση' : 'Αναπαραγωγή'}
          >
            {playing ? <Pause className="w-8 h-8" aria-hidden="true" /> : <Play className="w-8 h-8" aria-hidden="true" />}
          </button>

          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % media.length)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:ring-2 focus:ring-white focus:outline-none"
            aria-label="Επόμενη"
          >
            <ChevronRight className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { Suspense } from 'react';

export default function SlideshowPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-black flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      }
    >
      <SlideshowContent />
    </Suspense>
  );
}