'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Camera, CheckCircle2, Loader2, Heart, AlertCircle, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import { useLanguage, LanguageToggle } from '@/lib/i18n';
import { processUploadQueue, QueuedFile } from '@/lib/uploadQueue';

function GuestUploadContent() {
  const params = useParams();
  const slug = params.slug as string;

  const [guestId, setGuestId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [wish, setWish] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [myMedia, setMyMedia] = useState<Array<{id: string; public_url: string; mime_type: string; is_approved: boolean}>>([]);
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [showMyPhotos, setShowMyPhotos] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{id: string; public_url: string; mime_type: string} | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [eventInfo, setEventInfo] = useState<{
    title: string;
    event_date?: string | null;
    cover_url: string | null;
    welcome_message?: string;
    uploads_enabled?: boolean;
    allow_videos?: boolean;
    theme_color?: string;
  } | null>(null);

  const themeStyles: Record<string, { border: string; bg: string; text: string; bar: string }> = {
    rose: { border: 'border-rose-300', bg: 'bg-rose-50/50 hover:bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500' },
    amber: { border: 'border-amber-300', bg: 'bg-amber-50/50 hover:bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-600' },
    emerald: { border: 'border-emerald-300', bg: 'bg-emerald-50/50 hover:bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-600' },
    stone: { border: 'border-stone-400', bg: 'bg-stone-100/70 hover:bg-stone-100', text: 'text-stone-900', bar: 'bg-stone-900' },
  };
  const theme = themeStyles[eventInfo?.theme_color || 'rose'] || themeStyles.rose;

  const { t, lang } = useLanguage();

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/event?slug=${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.title) setEventInfo(data);
      })
      .catch((err) => console.error('Event fetch error:', err));
  }, [slug]);

  // Αρχικοποίηση ID καλεσμένου & αποθηκευμένου ονόματος
  useEffect(() => {
    const initGuest = () => {
      let id = localStorage.getItem('wedding_guest_id');
      if (!id) {
        id = 'guest_' + crypto.randomUUID();
        localStorage.setItem('wedding_guest_id', id);
      }
      setGuestId(id);

      const savedName = localStorage.getItem('wedding_guest_name');
      if (savedName) setGuestName(savedName);

      // Also check URL param for guest name (for QR link sharing)
      const urlParams = new URLSearchParams(window.location.search);
      const urlName = urlParams.get('guest');
      if (urlName && !savedName) {
        setGuestName(urlName);
        localStorage.setItem('wedding_guest_name', urlName);
      }
    };
    initGuest();
  }, []);

  // Fetch my uploaded media
  useEffect(() => {
    if (!guestId || !slug) return;
    const fetchMyMedia = async () => {
      try {
        const res = await fetch(`/api/my-media?slug=${slug}&guestId=${guestId}`);
        if (res.ok) {
          const data = await res.json();
          setMyMedia(data.media || []);
        }
      } catch (err) {
        console.error('Fetch my media error:', err);
      }
    };
    fetchMyMedia();
  }, [guestId, slug]);

  // Προειδοποίηση αν κλείσει τον browser κατά το upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploading]);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {}
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {}
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (guestName.trim()) {
      localStorage.setItem('wedding_guest_name', guestName.trim());
    }

    setUploading(true);
    setStatusMsg('');
    abortControllerRef.current = new AbortController();

    const initialQueue: QueuedFile[] = files.map((file) => ({
      file,
      fileHash: '',
      status: 'pending' as const,
      progress: 0,
      retries: 0,
    }));
    setFileQueue(initialQueue);
    await requestWakeLock();

    await processUploadQueue(
      files,
      slug,
      guestId,
      guestName,
      wish,
      eventInfo,
      (queue) => setFileQueue(queue),
      ({ done, errors }) => {
        setUploading(false);
        releaseWakeLock();
        if (errors > 0) {
          setStatusMsg(t.uploadSuccess(done, 0) + ` (${errors} ${t.failed || 'απέτυχαν'})`);
        } else {
          setStatusMsg(t.uploadSuccess(done, 0));
        }
        setWish('');
      },
      abortControllerRef.current.signal
    );
  };

  const cancelUpload = () => {
    abortControllerRef.current?.abort();
    setUploading(false);
    releaseWakeLock();
    setStatusMsg('');
  };

  const retryFailed = () => {
    const failedFiles = fileQueue.filter((f) => f.status === 'error').map((f) => f.file);
    if (failedFiles.length === 0) return;
    setUploading(true);
    setStatusMsg('');
    abortControllerRef.current = new AbortController();

    const initialQueue: QueuedFile[] = failedFiles.map((file) => ({
      file,
      fileHash: '',
      status: 'pending' as const,
      progress: 0,
      retries: 0,
    }));
    setFileQueue((prev) => prev.map((f) => (f.status === 'error' ? { ...f, status: 'pending' as const, error: undefined, retries: 0, progress: 0 } : f)));

    processUploadQueue(
      failedFiles,
      slug,
      guestId,
      guestName,
      wish,
      eventInfo,
      (queue) => setFileQueue((prev) => {
        // Merge: keep done files, update failed ones
        const doneMap = new Map(prev.filter((f) => f.status === 'done').map((f) => [f.file.name, f]));
        return queue.map((q) => doneMap.get(q.file.name) || q);
      }),
      ({ done, errors }) => {
        setUploading(false);
        releaseWakeLock();
        if (errors > 0) {
          setStatusMsg(t.uploadSuccess(done, 0) + ` (${errors} ${t.failed || 'απέτυχαν'})`);
        } else {
          setStatusMsg(t.uploadSuccess(done, 0));
        }
        setWish('');
      },
      abortControllerRef.current.signal
    );
  };

  const percent = fileQueue.length > 0
    ? Math.round((fileQueue.filter((f) => f.status === 'done').length / fileQueue.length) * 100)
    : 0;

  const statusLabel = (status: QueuedFile['status']) => {
    switch (status) {
      case 'pending': return t.pending || 'Σε αναμονή';
      case 'hashing': return t.hashing || 'Υπολογισμός...';
      case 'presigning': return t.presigning || 'Προετοιμασία...';
      case 'uploading': return t.uploading || 'Ανέβασμα...';
      case 'completing': return t.completing || 'Ολοκλήρωση...';
      case 'done': return t.done || 'Ολοκληρώθηκε';
      case 'error': return t.error || 'Σφάλμα';
    }
  };

  const statusIcon = (status: QueuedFile['status']) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'uploading':
      case 'presigning':
      case 'completing':
      case 'hashing':
        return <Loader2 className="w-4 h-4 animate-spin text-stone-600" />;
      default:
        return <span className="w-4 h-4 text-stone-300" />;
    }
  };

 return (
    <main className="min-h-screen bg-[#FAF8F5] text-stone-800 flex flex-col items-center justify-center p-5 relative">
      {/* Επιλογή Γλώσσας EL / EN */}
      <div className="w-full max-w-md flex justify-end mb-3">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        {eventInfo?.cover_url && (
          <div className="relative w-full aspect-[3/4] bg-stone-100">
            <img
              src={eventInfo.cover_url}
              alt={eventInfo.title}
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/50 to-transparent" />
          </div>
        )}

        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            {!eventInfo?.cover_url && (
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${theme.bg} ${theme.text} mb-1`}>
                <Heart className="w-6 h-6 fill-current" />
              </div>
            )}

            {eventInfo?.title && (
              <p className={`text-xs uppercase tracking-widest ${theme.text} font-semibold`}>
                {eventInfo.title}
              </p>
            )}

            {eventInfo?.event_date && (
              <p className="text-xs text-stone-400 font-medium">
                {new Date(eventInfo.event_date).toLocaleDateString(
                  lang === 'el' ? 'el-GR' : 'en-US',
                  { day: 'numeric', month: 'long', year: 'numeric' }
                )}
              </p>
            )}

            <h1
              style={{ fontFamily: 'var(--font-serif)' }}
              className="text-3xl font-semibold tracking-tight text-stone-900"
            >
              {t.shareTitle}
            </h1>
            <p className="text-sm text-stone-600">
              {lang === 'el' && eventInfo?.welcome_message
                ? eventInfo.welcome_message
                : t.defaultWelcome}
            </p>
          </div>

          {eventInfo?.uploads_enabled === false ? (
            <div className="p-5 rounded-2xl bg-stone-100 text-center space-y-1" role="alert" aria-live="polite">
              <p className="text-sm font-semibold text-stone-800">{t.closedTitle}</p>
              <p className="text-xs text-stone-700">{t.closedDesc}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {t.nameLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.namePlaceholder}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  disabled={uploading}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {t.wishLabel}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.wishPlaceholder}
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                  disabled={uploading}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>

              {myMedia.length > 0 && (
                <div className="space-y-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-800">
                      {t.myPhotos || 'Οι φωτογραφίες μου'} ({myMedia.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowMyPhotos(!showMyPhotos)}
                      className="text-xs text-stone-600 hover:text-stone-900 focus:ring-2 focus:ring-stone-500 focus:outline-none rounded"
                    >
                      {showMyPhotos ? (t.hidePhotos || 'Απόκρυψη') : (t.showPhotos || 'Εμφάνιση')}
                    </button>
                  </div>
                  {showMyPhotos && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                        {myMedia.map((item) => {
                          const isSelected = selectedMedia.has(item.id);
                          return (
                            <div
                              key={item.id}
                              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                                isSelected ? 'border-rose-500 bg-rose-50' : 'border-stone-200 hover:border-stone-300'
                              }`}
                              onClick={(e) => {
                                // Don't open preview if clicking checkbox
                                if ((e.target as HTMLElement).tagName === 'INPUT') return;
                                setPreviewMedia({ id: item.id, public_url: item.public_url, mime_type: item.mime_type });
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const next = new Set(selectedMedia);
                                  if (e.target.checked) next.add(item.id);
                                  else next.delete(item.id);
                                  setSelectedMedia(next);
                                }}
                                className="absolute top-1 left-1 z-10 w-5 h-5 text-rose-600 border-stone-300 rounded bg-white"
                              />
                              {item.mime_type.startsWith('video/') ? (
                                <video src={item.public_url} className="w-full h-full object-cover" muted playsInline />
                              ) : (
                                <img src={item.public_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              )}
                              {!item.is_approved && (
                                <span className="absolute bottom-1 right-1 text-xs bg-amber-600/90 text-white px-1.5 py-0.5 rounded">
                                  {t.pendingApproval || 'Σε αναμονή'}
                                </span>
                              )}
                              <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                                {t.tapToPreview || 'Κλικ για προεπισκόπηση'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {selectedMedia.size > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-stone-700">
                            {selectedMedia.size} {t.selected || 'επιλεγμένα'}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(t.confirmDeleteSelected || 'Διαγραφή επιλεγμένων φωτογραφιών;')) return;
                              try {
                                const res = await fetch('/api/my-media', {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ slug, guestId, mediaIds: Array.from(selectedMedia) }),
                                });
                                if (!res.ok) throw new Error();
                                alert(t.deletedSelected || 'Οι επιλεγμένες φωτογραφίες διαγράφηκαν.');
                                setSelectedMedia(new Set());
                                // Refresh my media
                                const refreshRes = await fetch(`/api/my-media?slug=${slug}&guestId=${guestId}`);
                                if (refreshRes.ok) {
                                  const data = await refreshRes.json();
                                  setMyMedia(data.media || []);
                                }
                              } catch {
                                alert(t.deleteFailed || 'Αποτυχία διαγραφής');
                              }
                            }}
                            disabled={uploading}
                            className="flex-1 py-2 px-3 rounded-xl border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 inline mr-1" /> {t.deleteSelected || 'Διαγραφή επιλεγμένων'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMedia(new Set())}
                            className="px-3 py-2 rounded-xl border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-50 transition focus:ring-2 focus:ring-stone-500 focus:outline-none"
                          >
                            {t.clearSelection || 'Ακύρωση'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(t.confirmDeleteAllMyData || 'Διαγραφή ΟΛΩΝ των δικών σου αρχείων και δεδομένων;')) return;
                    try {
                      const res = await fetch('/api/gdpr/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ eventSlug: slug, guestId }),
                      });
                      if (!res.ok) throw new Error();
                      alert(t.dataDeleted || 'Τα δεδομένα σου διαγράφηκαν.');
                      setGuestName('');
                      localStorage.removeItem('wedding_guest_name');
                      setMyMedia([]);
                    } catch {
                      alert(t.deleteFailed || 'Αποτυχία διαγραφής');
                    }
                  }}
                  disabled={uploading}
                  className="w-full py-2 px-3 rounded-xl border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50 focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" /> {t.deleteAllMyData || 'Διαγραφή ΟΛΩΝ των δεδομένων μου'}
                </button>
              </div>

              <label
                className={`flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed transition cursor-pointer focus:ring-2 focus:ring-stone-500 focus:outline-none ${
                  uploading
                    ? 'border-stone-200 bg-stone-50 cursor-not-allowed'
                    : `${theme.border} ${theme.bg}`
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center space-y-2 px-4 text-center">
                    <Loader2 className={`w-8 h-8 ${theme.text} animate-spin`} />
                    <span className="text-sm font-medium text-stone-700">
                      {t.uploadingStatus(fileQueue.filter(f => f.status === 'done').length, fileQueue.length, percent)}
                    </span>
                    <span className="text-xs text-stone-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-stone-600" /> {t.keepScreenOn}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2 text-center px-4">
                    <Camera className={`w-8 h-8 ${theme.text}`} />
                    <span className={`text-sm font-semibold ${theme.text}`}>
                      {eventInfo?.allow_videos === false
                        ? t.selectPhotosOnly
                        : t.selectPhotosVideos}
                    </span>
                    <span className="text-xs text-stone-600">{t.selectHint}</span>
                  </div>
                )}
                <input
                  type="file"
                  multiple
                  accept={eventInfo?.allow_videos === false ? 'image/*' : 'image/*,video/*'}
                  onChange={handleFilesSelected}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {uploading && (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden mb-2">
                <div
                  className={`${theme.bar} h-2.5 transition-all duration-300`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              {fileQueue.map((item, idx) => (
                <div key={`${item.file.name}-${idx}`} className="flex items-center gap-3 p-2 rounded-xl bg-stone-50 border border-stone-100">
                  <div className="flex-shrink-0">{statusIcon(item.status)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-800 truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className={`${theme.bar} h-full transition-all duration-200`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-stone-600 w-20 text-right">{item.progress}%</span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">{statusLabel(item.status)}</p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={cancelUpload}
                className="w-full py-2 text-sm font-medium text-stone-600 hover:text-stone-900 focus:ring-2 focus:ring-stone-500 focus:outline-none rounded"
              >
                {t.cancelUpload || 'Ακύρωση ανεβάσματος'}
              </button>
            </div>
          )}

          {statusMsg && !uploading && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 text-emerald-800 text-sm" role="status" aria-live="polite">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{statusMsg}</span>
            </div>
          )}

          {fileQueue.length > 0 && !uploading && fileQueue.some((f) => f.status === 'error') && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 text-red-800 text-sm" role="alert" aria-live="assertive">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="flex-1">
                {fileQueue.filter((f) => f.status === 'error').length} {t.failedFiles || 'αρχεία απέτυχαν'}
              </span>
              <button
                type="button"
                onClick={retryFailed}
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 flex items-center gap-1 focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                {t.retry || 'Επανάληψη'}
              </button>
            </div>
          )}

          {/* Preview Modal */}
          {previewMedia && (
            <div
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setPreviewMedia(null)}
              role="dialog"
              aria-modal="true"
              aria-label={t.previewModalLabel || 'Preview'}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setPreviewMedia(null); }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"
                aria-label={t.closePreview || 'Close preview'}
              >
                <XCircle className="w-8 h-8" />
              </button>
              <div className="max-w-5xl max-h-[90vh] w-full relative">
                {previewMedia.mime_type.startsWith('video/') ? (
                  <video
                    src={previewMedia.public_url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[85vh] max-w-full rounded-xl"
                  />
                ) : (
                  <img
                    src={previewMedia.public_url}
                    alt=""
                    className="max-h-[85vh] max-w-full object-contain rounded-xl"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function GuestUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
        </div>
      }
    >
      <GuestUploadContent />
    </Suspense>
  );
}