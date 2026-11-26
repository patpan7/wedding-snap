'use client';

import React, { useState, useMemo, Suspense, useEffect } from 'react';
import { useParams } from 'next/navigation';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import {
  Lock,
  Download,
  Eye,
  EyeOff,
  QrCode,
  Loader2,
  Users,
  Heart,
  Printer,
  X,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Trash2,
  Settings,
  Play,
  Film,
} from 'lucide-react';

interface MediaItem {
  id: string;
  public_url: string;
  file_key: string;
  mime_type: string;
  guest_id: string;
  guest_name: string | null;
  wish: string | null;
  taken_at: string;
  is_approved: boolean;
}

function AdminDashboardContent() {
  const params = useParams();
  const slug = params.slug as string;

  const [pin, setPin] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [eventTitle, setEventTitle] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<string>('ALL');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'ALL' | 'PHOTOS' | 'VIDEOS'>('ALL');
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);

  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState({
    title: '',
    event_date: '',
    welcome_message: '',
    uploads_enabled: true,
    allow_videos: true,
    theme_color: 'rose',
    new_pin: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, pin }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError('Πολλές προσπάθειες. Δοκιμάστε ξανά σε ένα λεπτό.');
        } else {
          setError(data.error || 'Σφάλμα σύνδεσης');
        }
      } else {
        setEventTitle(data.event.title);
        setCoverUrl(data.event.cover_url || null);
        setSettings({
          title: data.event.title || '',
          event_date: data.event.event_date || '',
          welcome_message: data.event.welcome_message || '',
          uploads_enabled: data.event.uploads_enabled ?? true,
          allow_videos: data.event.allow_videos ?? true,
          theme_color: data.event.theme_color || 'rose',
          new_pin: '',
        });
        setMedia(data.media);
        setAuthenticated(true);
      }
    } catch {
      setError('Αποτυχία σύνδεσης με τον server');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          pin,
          action: 'update_settings',
          ...settings,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 429) throw new Error(data.error || 'Πολλές προσπάθειες');
        throw new Error();
      }

      setEventTitle(settings.title);
      if (settings.new_pin && settings.new_pin.trim().length >= 6) {
        setPin(settings.new_pin.trim());
        setSettings((s) => ({ ...s, new_pin: '' }));
      }
      setSettingsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης ρυθμίσεων';
      alert(msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteMedia = async (item: MediaItem) => {
    if (!confirm('Οριστική διαγραφή αυτού του αρχείου; Δεν μπορεί να αναιρεθεί.')) return;

    const previousMedia = media;
    setMedia((prev) => prev.filter((m) => m.id !== item.id));
    try {
      const res = await fetch('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, pin, mediaId: item.id, fileKey: item.file_key }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 429) throw new Error(data.error || 'Πολλές προσπάθειες');
        throw new Error();
      }
    } catch (err: unknown) {
      setMedia(previousMedia);
      const msg = err instanceof Error ? err.message : 'Αποτυχία διαγραφής';
      alert(msg);
    }
  };



  const toggleApproval = async (item: MediaItem) => {
    const newStatus = !item.is_approved;
    const previousMedia = media;
    setMedia((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, is_approved: newStatus } : m))
    );

    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, pin, mediaId: item.id, isApproved: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 429) throw new Error(data.error || 'Πολλές προσπάθειες');
        throw new Error();
      }
    } catch (err: unknown) {
      setMedia(previousMedia);
      const msg = err instanceof Error ? err.message : 'Αποτυχία ενημέρωσης';
      alert(msg);
    }
  };

  const toggleSelection = (mediaId: string) => {
    setSelectedMedia((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMedia.size === filteredMedia.length) {
      setSelectedMedia(new Set());
    } else {
      setSelectedMedia(new Set(filteredMedia.map((m) => m.id)));
    }
  };

  const clearSelection = () => {
    setSelectedMedia(new Set());
    setBulkActionMode(false);
  };

  const bulkAction = async (action: 'approve' | 'hide' | 'delete') => {
    if (selectedMedia.size === 0) return;
    const previousMedia = media;
    const ids = Array.from(selectedMedia);

    if (action === 'delete') {
      if (!confirm(`Διαγραφή ${ids.length} αρχείων; Δεν μπορεί να αναιρεθεί.`)) return;
    }

    setMedia((prev) =>
      prev.map((m) => {
        if (!ids.includes(m.id)) return m;
        if (action === 'delete') return { ...m, _deleting: true };
        return { ...m, is_approved: action === 'approve' };
      })
    );

    try {
      for (const id of ids) {
        const item = media.find((m) => m.id === id);
        if (!item) continue;

        if (action === 'delete') {
          await fetch('/api/admin', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, pin, mediaId: id, fileKey: item.file_key }),
          });
        } else {
          await fetch('/api/admin', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, pin, mediaId: id, isApproved: action === 'approve' }),
          });
        }
      }
      setMedia((prev) => prev.filter((m) => !ids.includes(m.id)));
      clearSelection();
    } catch (err: unknown) {
      setMedia(previousMedia);
      const msg = err instanceof Error ? err.message : 'Αποτυχία μαζικής ενέργειας';
      alert(msg);
    }
  };

  // Ομαδοποίηση καλεσμένων για το φίλτρο
  const guests = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    media.forEach((m) => {
      const existing = map.get(m.guest_id);
      const label = m.guest_name || `Ανώνυμος (${m.guest_id.slice(6, 11)})`;
      if (existing) {
        existing.count++;
        if (m.guest_name) existing.label = m.guest_name;
      } else {
        map.set(m.guest_id, { label, count: 1 });
      }
    });
    return Array.from(map.entries());
  }, [media]);

  const filteredMedia = useMemo(() => {
    let result = media;
    if (selectedGuest === 'PENDING') {
      result = media.filter((m) => !m.is_approved);
    } else if (selectedGuest !== 'ALL') {
      result = media.filter((m) => m.guest_id === selectedGuest);
    }
    if (mediaTypeFilter === 'PHOTOS') {
      result = result.filter((m) => m.mime_type.startsWith('image/'));
    } else if (mediaTypeFilter === 'VIDEOS') {
      result = result.filter((m) => m.mime_type.startsWith('video/'));
    }
    return result;
  }, [media, selectedGuest, mediaTypeFilter]);

  const handleDownloadZip = async () => {
    const approvedItems = media.filter((m) => m.is_approved);
    if (approvedItems.length === 0) return;

    setZipping(true);
    const zip = new JSZip();

    try {
      for (let i = 0; i < approvedItems.length; i++) {
        const item = approvedItems[i];
        setZipProgress(`Λήψη ${i + 1} από ${approvedItems.length}...`);
        const response = await fetch(item.public_url);
        const blob = await response.blob();
        const ext = item.file_key.split('.').pop() || 'jpg';
        const author = (item.guest_name || 'guest').replace(/[^a-zA-Z0-9α-ωΑ-Ωά-ώ]/g, '_');
        zip.file(`${String(i + 1).padStart(3, '0')}_${author}.${ext}`, blob);
      }

      setZipProgress('Δημιουργία ZIP...');
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-photos.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Παρουσιάστηκε σφάλμα κατά το κατέβασμα.');
    } finally {
      setZipping(false);
      setZipProgress('');
    }
  };

  const openQrModal = async () => {
    const guestUrl = `${window.location.origin}/g/${slug}`;
    const dataUrl = await QRCode.toDataURL(guestUrl, {
      width: 800,
      margin: 2,
      color: { dark: '#1c1917', light: '#ffffff' },
    });
    setQrDataUrl(dataUrl);
    setQrModalOpen(true);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);

    try {
      const presignRes = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          pin,
          action: 'presign',
          fileName: file.name,
          fileType: file.type || 'image/jpeg',
        }),
      });
      if (!presignRes.ok) {
        const data = await presignRes.json();
        if (presignRes.status === 429) throw new Error(data.error || 'Πολλές προσπάθειες');
        throw new Error();
      }
      const { uploadUrl, coverUrl: newCoverUrl } = await presignRes.json();

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      });

      const saveRes = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, pin, action: 'save', coverUrl: newCoverUrl }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json();
        if (saveRes.status === 429) throw new Error(data.error || 'Πολλές προσπάθειες');
        throw new Error();
      }

      setCoverUrl(newCoverUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία ανεβάσματος φωτογραφίας εξωφύλλου';
      alert(msg);
    } finally {
      setUploadingCover(false);
    }
  };

  const [qrStyle, setQrStyle] = useState<'ivory' | 'gold' | 'dark'>('ivory');
  const [cardSubtitle, setCardSubtitle] = useState('Σκανάρετε για να μοιραστείτε τις φωτογραφίες σας');
  const [cardSubtitleEn, setCardSubtitleEn] = useState('Scan to share your photos & wishes');

  const guestUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/g/${slug}` : '';

  // Δημιουργία υψηλής ανάλυσης QR κάθε φορά που ανοίγει το modal ή αλλάζει στυλ
useEffect(() => {
    if (!qrModalOpen || !guestUrl) return;
    QRCode.toDataURL(guestUrl, {
      width: 900,
      margin: 1,
      color: {
        dark: qrStyle === 'dark' ? '#FFFFFF' : '#1C1917',
        light: qrStyle === 'dark' ? '#1C1917' : '#FFFFFF',
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [qrModalOpen, guestUrl, qrStyle]);

  // Εξαγωγή έτοιμου καρτελακιού A6 (1200x1700 px) σε PNG
const handleCardExport = async (mode: 'download' | 'print') => {
    if (!qrDataUrl) return;

    const canvas = document.createElement('canvas');
    const W = 1200;
    const H = 1700;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palettes = {
      ivory: { bg: '#FAF8F5', border: '#D6D3D1', accent: '#92400E', text: '#1C1917', muted: '#57534E' },
      gold: { bg: '#FFFDF9', border: '#D97706', accent: '#B45309', text: '#1C1917', muted: '#78716C' },
      dark: { bg: '#1C1917', border: '#57534E', accent: '#FBBF24', text: '#FAF8F5', muted: '#A8A29E' },
    };
    const p = palettes[qrStyle];

    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = p.border;
    ctx.lineWidth = qrStyle === 'gold' ? 6 : 3;
    ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(82, 82, W - 164, H - 164);

    ctx.textAlign = 'center';

    ctx.fillStyle = p.accent;
    ctx.font = '600 26px sans-serif';
    ctx.fillText('DIGITAL WEDDING ALBUM', W / 2, 195);

    ctx.fillStyle = p.text;
    ctx.font = '600 68px Georgia, serif';
    ctx.fillText(eventTitle || 'Wedding Moments', W / 2, 295);

    if (settings?.event_date) {
      const formattedDate = new Date(settings.event_date).toLocaleDateString('el-GR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      ctx.fillStyle = p.muted;
      ctx.font = '400 32px Georgia, serif';
      ctx.fillText(formattedDate, W / 2, 360);
    }

    const qrImg = new window.Image();
    qrImg.src = qrDataUrl;
    await new Promise((resolve) => {
      qrImg.onload = resolve;
    });

    const qrBoxSize = 680;
    const qrX = (W - qrBoxSize) / 2;
    const qrY = 445;

    ctx.fillStyle = qrStyle === 'dark' ? '#1C1917' : '#FFFFFF';
    ctx.fillRect(qrX - 30, qrY - 30, qrBoxSize + 60, qrBoxSize + 60);
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 30, qrY - 30, qrBoxSize + 60, qrBoxSize + 60);

    ctx.drawImage(qrImg, qrX, qrY, qrBoxSize, qrBoxSize);

    ctx.fillStyle = p.text;
    ctx.font = '600 36px sans-serif';
    ctx.fillText(cardSubtitle, W / 2, 1265);

    ctx.fillStyle = p.muted;
    ctx.font = '400 30px sans-serif';
    ctx.fillText(cardSubtitleEn, W / 2, 1325);

    ctx.fillStyle = p.accent;
    ctx.font = '600 24px sans-serif';
    ctx.fillText('ΧΩΡΙΣ ΕΦΑΡΜΟΓΗ  •  NO APP REQUIRED', W / 2, 1465);

    ctx.fillStyle = p.muted;
    ctx.font = '400 22px monospace';
    ctx.fillText(guestUrl.replace(/^https?:\/\//, ''), W / 2, 1550);

    const dataUrl = canvas.toDataURL('image/png');

    if (mode === 'download') {
      const link = document.createElement('a');
      link.download = `table-card-${slug}-${qrStyle}.png`;
      link.href = dataUrl;
      link.click();
    } else {
      const printWin = window.open('', '_blank');
      if (!printWin) return;
      printWin.document.write(`
        <html>
          <head>
            <title>Εκτύπωση Καρτελακιού - ${eventTitle}</title>
            <style>
              @page { size: A6 portrait; margin: 0; }
              body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
              img { width: 105mm; height: 148mm; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  // Λήψη μόνο του σκέτου QR (για γραφίστα)
  const handleDownloadPlainQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `qr-only-${slug}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center p-5">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-stone-200 p-6 space-y-5"
        >
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 text-stone-700">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold text-stone-800">Διαχείριση Άλμπουμ</h1>
            <p className="text-xs text-stone-600">Εισάγετε το PIN της εκδήλωσης για πρόσβαση</p>
          </div>

          <input
            type="password"
            inputMode="numeric"
            placeholder="Κωδικός PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full text-center tracking-widest text-lg rounded-xl border border-stone-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-400"
            required
          />

          {error && <p className="text-xs text-center text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Είσοδος
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-800 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{eventTitle}</h1>
            <p className="text-xs text-stone-600">
              {media.length} αρχεία από {guests.length} καλεσμένους
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={openQrModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm font-medium hover:bg-stone-50"
            >
              <QrCode className="w-4 h-4" />
              QR Τραπεζιών
            </button>

            <button
              onClick={() => window.open(`/g/${slug}/slideshow`, '_blank')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm font-medium hover:bg-stone-50"
            >
              <Play className="w-4 h-4" />
              Slideshow
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm font-medium hover:bg-stone-50"
            >
              <Settings className="w-4 h-4" />
              Ρυθμίσεις
            </button>

            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm font-medium hover:bg-stone-50 cursor-pointer">
              {uploadingCover ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              <span>{coverUrl ? 'Αλλαγή Φωτό Ζευγαριού' : 'Φωτό Ζευγαριού'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={uploadingCover}
                className="hidden"
              />
            </label>

            <button
              onClick={handleDownloadZip}
              disabled={zipping || media.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 disabled:opacity-50"
            >
              {zipping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {zipProgress}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Λήψη Όλων (ZIP)
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Φίλτρο Καλεσμένων */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Users className="w-4 h-4 text-stone-400 shrink-0" />
          <button
            onClick={() => setSelectedGuest('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
              selectedGuest === 'ALL'
                ? 'bg-stone-800 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            Όλοι ({media.length})
          </button>
          <button
            onClick={() => setSelectedGuest('PENDING')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
              selectedGuest === 'PENDING'
                ? 'bg-amber-600 text-white'
                : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
            }`}
          >
            Αναμονή έγκρισης ({media.filter((m) => !m.is_approved).length})
          </button>
          {guests.map(([gId, info]) => (
            <button
              key={gId}
              onClick={() => setSelectedGuest(gId)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
                selectedGuest === gId
                  ? 'bg-stone-800 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {info.label} ({info.count})
            </button>
          ))}
        </div>

        {/* Φίλτρο Τύπου Μέσου */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Film className="w-4 h-4 text-stone-400 shrink-0" />
          <button
            onClick={() => setMediaTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
              mediaTypeFilter === 'ALL'
                ? 'bg-stone-800 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            Όλα ({media.length})
          </button>
          <button
            onClick={() => setMediaTypeFilter('PHOTOS')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
              mediaTypeFilter === 'PHOTOS'
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Φωτογραφίες ({media.filter((m) => m.mime_type.startsWith('image/')).length})
          </button>
          <button
            onClick={() => setMediaTypeFilter('VIDEOS')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
              mediaTypeFilter === 'VIDEOS'
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-violet-200 text-violet-700 hover:bg-violet-50'
            }`}
          >
            Βίντεο ({media.filter((m) => m.mime_type.startsWith('video/')).length})
          </button>
        </div>

        {/* Ευχές Καλεσμένων */}
        {media.some((m) => m.wish) && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500" /> Ευχές Καλεσμένων
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {media
                .filter((m) => m.wish)
                .map((m) => (
                  <div
                    key={m.id}
                    className="bg-white p-4 rounded-2xl border border-stone-200 text-sm space-y-1.5"
                  >
                    <p className="text-stone-700 italic">«{m.wish}»</p>
                    <p className="text-xs font-medium text-stone-600">
                      — {m.guest_name || 'Ανώνυμος καλεσμένος'}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        )}

{/* Πλέγμα Φωτογραφιών */}
        {bulkActionMode && selectedMedia.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-stone-900 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-4 text-sm">
            <span>{selectedMedia.size} επιλεγμένα</span>
            <button onClick={() => bulkAction('approve')} className="px-3 py-1.5 bg-emerald-600 rounded-lg hover:bg-emerald-700">Εγγραφή</button>
            <button onClick={() => bulkAction('hide')} className="px-3 py-1.5 bg-amber-600 rounded-lg hover:bg-amber-700">Απόκρυψη</button>
            <button onClick={() => bulkAction('delete')} className="px-3 py-1.5 bg-red-600 rounded-lg hover:bg-red-700">Διαγραφή</button>
            <button onClick={clearSelection} className="px-3 py-1.5 bg-stone-700 rounded-lg hover:bg-stone-600">Ακύρωση</button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredMedia.map((item, idx) => {
            const isSelected = selectedMedia.has(item.id);
            return (
              <div
                key={item.id}
                className={`group relative rounded-2xl overflow-hidden bg-stone-200 border border-stone-200 aspect-square transition-all ${
                  !item.is_approved ? 'opacity-40' : ''
                } ${isSelected ? 'ring-2 ring-stone-900' : ''}`}
              >
                {bulkActionMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(item.id);
                      }}
                      className="w-5 h-5 text-stone-900 border-stone-300 rounded focus:ring-stone-500 bg-white"
                    />
                  </div>
                )}
                {item.mime_type.startsWith('video/') ? (
                  <video
                    src={item.public_url}
                    onClick={() => bulkActionMode ? toggleSelection(item.id) : setPreviewIndex(idx)}
                    className="w-full h-full object-cover cursor-pointer"
                  />
                ) : (
                  <img
                    src={item.public_url}
                    alt={item.guest_name || 'Wedding photo'}
                    loading="lazy"
                    onClick={() => bulkActionMode ? toggleSelection(item.id) : setPreviewIndex(idx)}
                    className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                  />
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 flex items-end justify-between pointer-events-none">
                  <span className="text-xs text-white font-medium truncate pr-2">
                    {item.guest_name || 'Ανώνυμος'}
                  </span>
                  {!bulkActionMode && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleApproval(item);
                        }}
                        aria-label={item.is_approved ? 'Απόκρυψη από ZIP' : 'Εμφάνιση'}
                        className="p-1.5 rounded-lg bg-white/90 text-stone-800 hover:bg-white pointer-events-auto focus:ring-2 focus:ring-stone-500 focus:outline-none"
                      >
                        {item.is_approved ? (
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                        )}
                      </button>
                      <div className="flex items-center gap-1.5 pointer-events-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleApproval(item);
                          }}
                          aria-label={item.is_approved ? 'Απόκρυψη από ZIP' : 'Εμφάνιση'}
                          className="p-1.5 rounded-lg bg-white/90 text-stone-800 hover:bg-white focus:ring-2 focus:ring-stone-500 focus:outline-none"
                        >
                          {item.is_approved ? (
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMedia(item);
                          }}
                          aria-label="Οριστική διαγραφή"
                          className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  )}
                  {bulkActionMode && isSelected && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-stone-900/80 text-white px-1.5 py-0.5 rounded">
                        ✓
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Εξαγωγής & Εκτύπωσης Καρτελακιού Τραπεζιού */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 relative my-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-stone-900">
                  Καρτελάκι Τραπεζιού &amp; QR Code
                </h3>
                <p className="text-xs text-stone-600">
                  Υψηλή ανάλυση (1200×1700 px) έτοιμη για εκτύπωση A6 / A5
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 focus:ring-2 focus:ring-stone-500 focus:outline-none"
                aria-label="Κλείσιμο διαλόγου"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Ζωντανή Προεπισκόπηση Καρτελακιού */}
              <div
                className={`aspect-[12/17] w-full max-w-[270px] mx-auto rounded-xl p-5 flex flex-col items-center justify-between text-center shadow-md border transition-colors ${
                  qrStyle === 'dark'
                    ? 'bg-stone-900 text-stone-50 border-stone-700'
                    : qrStyle === 'gold'
                    ? 'bg-[#FFFDF9] text-stone-900 border-amber-500'
                    : 'bg-[#FAF8F5] text-stone-900 border-stone-300'
                }`}
              >
                <div
                  className={`w-full h-full border p-3.5 flex flex-col items-center justify-between ${
                    qrStyle === 'dark'
                      ? 'border-stone-700'
                      : qrStyle === 'gold'
                      ? 'border-amber-500/70'
                      : 'border-stone-300'
                  }`}
                >
                  <div className="space-y-1 pt-1">
                    <p
                      className={`text-[8px] tracking-widest uppercase font-semibold ${
                        qrStyle === 'dark' ? 'text-amber-400' : 'text-amber-800'
                      }`}
                    >
                      Digital Wedding Album
                    </p>
                    <h4
                      style={{ fontFamily: 'var(--font-serif)' }}
                      className="text-lg font-semibold leading-tight"
                    >
                      {eventTitle}
                    </h4>
                  </div>

                  {qrDataUrl && (
                    <div
                      className={`p-2 rounded-lg border ${
                        qrStyle === 'dark'
                          ? 'bg-stone-900 border-stone-700'
                          : 'bg-white border-stone-200'
                      }`}
                    >
                      <img src={qrDataUrl} alt="QR Code" className="w-36 h-36" />
                    </div>
                  )}

                  <div className="space-y-1 pb-1">
                    <p className="text-[10px] font-semibold leading-snug">{cardSubtitle}</p>
                    <p
                      className={`text-[9px] leading-snug ${
                        qrStyle === 'dark' ? 'text-stone-500' : 'text-stone-600'
                      }`}
                    >
                      {cardSubtitleEn}
                    </p>
                    <p
                      className={`text-[7px] tracking-wider uppercase font-semibold pt-1 ${
                        qrStyle === 'dark' ? 'text-amber-400' : 'text-amber-800'
                      }`}
                    >
                      Χωρίς Εφαρμογή • No App Required
                    </p>
                  </div>
                </div>
              </div>

              {/* Επιλογές & Κουμπιά Εξαγωγής */}
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    Στυλ Καρτελακιού
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'ivory', label: 'Ιβουάρ' },
                      { id: 'gold', label: 'Χρυσό' },
                      { id: 'dark', label: 'Μαύρο' },
                    ].map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setQrStyle(s.id as 'ivory' | 'gold' | 'dark')}
                        className={`py-2 rounded-xl border text-xs font-medium transition ${
                          qrStyle === s.id
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Κείμενο Οδηγιών (Ελληνικά)
                  </label>
                  <input
                    type="text"
                    value={cardSubtitle}
                    onChange={(e) => setCardSubtitle(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Κείμενο Οδηγιών (Αγγλικά)
                  </label>
                  <input
                    type="text"
                    value={cardSubtitleEn}
                    onChange={(e) => setCardSubtitleEn(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleCardExport('download')}
                    className="w-full py-2.5 px-4 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Λήψη Καρτελακιού (PNG 300 DPI)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCardExport('print')}
                    className="w-full py-2 px-4 rounded-xl border border-stone-900 text-stone-900 text-xs font-semibold hover:bg-stone-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Εκτύπωση μόνο του Καρτελακιού
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPlainQr}
                    className="w-full py-2 px-4 rounded-xl border border-stone-200 text-stone-700 text-xs font-medium hover:bg-stone-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Λήψη μόνο σκέτου QR (για γραφίστα)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox Preview Πλήρους Οθόνης */}
      {previewIndex !== null && filteredMedia[previewIndex] && (
        <div
          onClick={() => setPreviewIndex(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Προεπισκόπηση φωτογραφίας"
        >
          {/* Κλείσιμο */}
          <button
            onClick={() => setPreviewIndex(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:ring-2 focus:ring-white focus:outline-none"
            aria-label="Κλείσιμο προεπισκόπησης"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>

          {/* Προηγούμενη */}
          {previewIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewIndex(previewIndex - 1);
              }}
              className="absolute left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:ring-2 focus:ring-white focus:outline-none"
              aria-label="Προηγούμενη"
            >
              <ChevronLeft className="w-7 h-7" aria-hidden="true" />
            </button>
          )}

          {/* Περιεχόμενο (Φωτογραφία ή Βίντεο) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center gap-3"
          >
            {filteredMedia[previewIndex].mime_type.startsWith('video/') ? (
              <video
                src={filteredMedia[previewIndex].public_url}
                controls
                autoPlay
                className="max-h-[75vh] rounded-xl"
              />
            ) : (
              <img
                src={filteredMedia[previewIndex].public_url}
                alt="Preview"
                className="max-h-[75vh] max-w-full object-contain rounded-xl"
              />
            )}

            <div className="text-center text-white space-y-1">
              <p className="text-sm font-medium">
                {filteredMedia[previewIndex].guest_name || 'Ανώνυμος καλεσμένος'}{' '}
                <span className="text-xs text-stone-400">
                  ({previewIndex + 1} / {filteredMedia.length})
                </span>
              </p>
              {filteredMedia[previewIndex].wish && (
                <p className="text-xs text-stone-300 italic">
                  «{filteredMedia[previewIndex].wish}»
                </p>
              )}
            </div>
          </div>

          {/* Επόμενη */}
          {previewIndex < filteredMedia.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewIndex(previewIndex + 1);
              }}
              className="absolute right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:ring-2 focus:ring-white focus:outline-none"
              aria-label="Επόμενη"
            >
              <ChevronRight className="w-7 h-7" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Modal Ρυθμίσεων Εκδήλωσης */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveSettings}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 relative my-8"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-semibold text-stone-900">Ρυθμίσεις Εκδήλωσης</h3>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 focus:ring-2 focus:ring-stone-500 focus:outline-none"
                aria-label="Κλείσιμο ρυθμίσεων"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Τίτλος Εκδήλωσης
                </label>
                <input
                  type="text"
                  required
                  value={settings.title}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Ημερομηνία Γάμου
                </label>
                <input
                  type="date"
                  value={settings.event_date}
                  onChange={(e) => setSettings({ ...settings, event_date: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Κείμενο Καλωσορίσματος Καλεσμένων
                </label>
                <textarea
                  rows={2}
                  value={settings.welcome_message}
                  onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Χρωματικό Θέμα Σελίδας
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'rose', label: 'Ροζ', swatch: 'bg-rose-500' },
                    { id: 'amber', label: 'Χρυσό', swatch: 'bg-amber-600' },
                    { id: 'emerald', label: 'Πράσινο', swatch: 'bg-emerald-600' },
                    { id: 'stone', label: 'Μαύρο', swatch: 'bg-stone-900' },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setSettings({ ...settings, theme_color: t.id })}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium ${
                        settings.theme_color === t.id
                          ? 'border-stone-900 bg-stone-100'
                          : 'border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${t.swatch}`} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 space-y-2.5 border-t border-stone-100">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-stone-700 font-medium">Αποδοχή νέων αρχείων</span>
                  <input
                    type="checkbox"
                    checked={settings.uploads_enabled}
                    onChange={(e) => setSettings({ ...settings, uploads_enabled: e.target.checked })}
                    className="w-4 h-4 accent-stone-900"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-stone-700 font-medium">Επιτρέπονται και Βίντεο</span>
                  <input
                    type="checkbox"
                    checked={settings.allow_videos}
                    onChange={(e) => setSettings({ ...settings, allow_videos: e.target.checked })}
                    className="w-4 h-4 accent-stone-900"
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-stone-100">
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Αλλαγή PIN Διαχειριστή (προαιρετικό, τουλ. 6 ψηφία, μόνο νούμερα)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Αφήστε κενό για να μείνει το ίδιο"
                  value={settings.new_pin}
                  onChange={(e) => setSettings({ ...settings, new_pin: e.target.value })}
                  className={`w-full rounded-xl px-3 py-2 text-sm ${
                    settings.new_pin && settings.new_pin.length < 6
                      ? 'border-red-400 focus:ring-2 focus:ring-red-300'
                      : 'border-stone-300 focus:ring-2 focus:ring-stone-400'
                  }`}
                />
                {settings.new_pin && settings.new_pin.length > 0 && settings.new_pin.length < 6 && (
                  <p className="text-xs text-red-600 mt-1">Το PIN πρέπει να είναι τουλάχιστον 6 ψηφία</p>
                )}
                {settings.new_pin && settings.new_pin.length >= 6 && !/^\d+$/.test(settings.new_pin) && (
                  <p className="text-xs text-red-600 mt-1">Το PIN πρέπει να περιέχει μόνο νούμερα</p>
                )}
                {settings.new_pin && /^(\d)\1+$/.test(settings.new_pin) && (
                  <p className="text-xs text-amber-700 mt-1">Προειδοποίηση: Αποφύγετε τα ίδια ψηφία (π.χ. 111111)</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 flex items-center justify-center gap-2"
            >
              {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
              Αποθήκευση Αλλαγών
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center text-sm text-stone-600">
          Φόρτωση...
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}