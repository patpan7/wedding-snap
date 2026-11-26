'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Lang = 'el' | 'en';

const translations = {
  el: {
    // Αρχική σελίδα
    badge: 'Ψηφιακό Άλμπουμ & Βιβλίο Ευχών',
    heroTitle: 'Κάθε αυθόρμητη στιγμή του γάμου σας, σε ένα μέρος.',
    heroSubtitle:
      'Οι καλεσμένοι σας σκανάρουν το QR code του τραπεζιού και ανεβάζουν αμέσως φωτογραφίες & βίντεο στην αυθεντική τους ανάλυση — χωρίς εφαρμογές και κωδικούς.',
    eventPlaceholder: 'Κωδικός γάμου (π.χ. stefanos-ntina)',
    openBtn: 'Άνοιγμα',
    step1Title: '1. Ένα σκανάρισμα',
    step1Desc: 'Ανοίγει απευθείας από την κάμερα του κινητού, χωρίς εγκατάσταση εφαρμογής ή εγγραφή.',
    step2Title: '2. Αυθεντική ποιότητα',
    step2Desc: 'Καμία συμπίεση όπως στα μηνύματα. Όλες οι φωτογραφίες και τα 4K βίντεο μένουν ανέπαφα.',
    step3Title: '3. Όλα ταξινομημένα',
    step3Desc: 'Χρονολογική σειρά λήψης, ευχές καλεσμένων και μαζική λήψη σε ένα αρχείο ZIP.',
    footer: 'Φτιαγμένο με αγάπη για αξέχαστες στιγμές',

    // Σελίδα Καλεσμένου
    shareTitle: 'Μοιραστείτε τις στιγμές μας',
    defaultWelcome: 'Ανεβάστε τις φωτογραφίες και τα βίντεο που τραβήξατε στην αυθεντική τους ποιότητα.',
    closedTitle: 'Το ψηφιακό άλμπουμ έχει ολοκληρωθεί',
    closedDesc: 'Ευχαριστούμε όλους για τις υπέροχες αναμνήσεις που μοιραστήκατε μαζί μας!',
    nameLabel: 'Το όνομά σας (προαιρετικό)',
    namePlaceholder: 'π.χ. Γιώργος & Ελένη',
    wishLabel: 'Αφήστε μια ευχή (προαιρετικό)',
    wishPlaceholder: 'Να ζήσετε ευτυχισμένοι...',
    selectPhotosVideos: 'Επιλογή Φωτογραφιών & Βίντεο',
    selectPhotosOnly: 'Επιλογή Φωτογραφιών',
    selectHint: 'Μπορείτε να διαλέξετε πολλά αρχεία μαζί',
    keepScreenOn: 'Κρατήστε την οθόνη ανοιχτή',
    uploadingStatus: (done: number, total: number, pct: number) =>
      `Αποστολή ${done} από ${total} (${pct}%)`,
    uploadSuccess: (done: number, skipped: number) =>
      `Ευχαριστούμε! Ανέβηκαν ${done} αρχεία${skipped > 0 ? ` (${skipped} υπήρχαν ήδη)` : ''}.`,

    // Upload queue status
    pending: 'Σε αναμονή',
    hashing: 'Υπολογισμός...',
    presigning: 'Προετοιμασία...',
    uploading: 'Ανέβασμα...',
    completing: 'Ολοκλήρωση...',
    done: 'Ολοκληρώθηκε',
    error: 'Σφάλμα',
    failed: 'απέτυχαν',
    failedFiles: 'αρχεία απέτυχαν',
    cancelUpload: 'Ακύρωση ανεβάσματος',
    retry: 'Επανάληψη',

    // GDPR
    deleteMyData: 'Διαγραφή δεδομένων μου',
    confirmDeleteMyData: 'Διαγραφή όλων των δικών σου αρχείων και δεδομένων;',
    dataDeleted: 'Τα δεδομένα σου διαγράφηκαν.',
    deleteFailed: 'Αποτυχία διαγραφής',

    // Self-moderation
    myPhotos: 'Οι φωτογραφίες μου',
    showPhotos: 'Εμφάνιση',
    hidePhotos: 'Απόκρυψη',
    pendingApproval: 'Σε αναμονή',
    selected: 'επιλεγμένα',
    deleteSelected: 'Διαγραφή επιλεγμένων',
    confirmDeleteSelected: 'Διαγραφή επιλεγμένων φωτογραφιών;',
    deletedSelected: 'Οι επιλεγμένες φωτογραφίες διαγράφηκαν.',
    clearSelection: 'Ακύρωση',
    deleteAllMyData: 'Διαγραφή ΟΛΩΝ των δεδομένων μου',
    confirmDeleteAllMyData: 'Διαγραφή ΟΛΩΝ των δικών σου αρχείων και δεδομένων;',

    // Preview
    tapToPreview: 'Κλικ για προεπισκόπηση',
    previewModalLabel: 'Προεπισκόπηση φωτογραφίας',
    closePreview: 'Κλείσιμο προεπισκόπησης',
  },
  en: {
    // Home Page
    badge: 'Digital Wedding Album & Guestbook',
    heroTitle: 'Every candid moment of your wedding, in one place.',
    heroSubtitle:
      'Your guests scan the table QR code and instantly upload photos & videos in original quality — no apps or sign-ups required.',
    eventPlaceholder: 'Event code (e.g. stefanos-ntina)',
    openBtn: 'Open',
    step1Title: '1. One simple scan',
    step1Desc: 'Opens straight from the phone camera, with no app download or account registration.',
    step2Title: '2. Original quality',
    step2Desc: 'Zero compression unlike messaging apps. All photos and 4K videos stay untouched.',
    step3Title: '3. Neatly organized',
    step3Desc: 'Sorted chronologically with guest wishes and one-click bulk ZIP download.',
    footer: 'Crafted with love for unforgettable moments',

    // Guest Page
    shareTitle: 'Share our moments',
    defaultWelcome: 'Upload the photos and videos you captured in their original full quality.',
    closedTitle: 'The digital album is now closed',
    closedDesc: 'Thank you all for the wonderful memories you shared with us!',
    nameLabel: 'Your name (optional)',
    namePlaceholder: 'e.g. George & Elena',
    wishLabel: 'Leave a wish (optional)',
    wishPlaceholder: 'Wishing you a lifetime of happiness...',
    selectPhotosVideos: 'Select Photos & Videos',
    selectPhotosOnly: 'Select Photos',
    selectHint: 'You can select multiple files at once',
    keepScreenOn: 'Please keep your screen on',
    uploadingStatus: (done: number, total: number, pct: number) =>
      `Uploading ${done} of ${total} (${pct}%)`,
    uploadSuccess: (done: number, skipped: number) =>
      `Thank you! Uploaded ${done} files${skipped > 0 ? ` (${skipped} already uploaded)` : ''}.`,

    // Upload queue status
    pending: 'Pending',
    hashing: 'Hashing...',
    presigning: 'Preparing...',
    uploading: 'Uploading...',
    completing: 'Finishing...',
    done: 'Done',
    error: 'Error',
    failed: 'failed',
    failedFiles: 'files failed',
    cancelUpload: 'Cancel upload',
    retry: 'Retry',

    // GDPR
    deleteMyData: 'Delete my data',
    confirmDeleteMyData: 'Delete all your files and data?',
    dataDeleted: 'Your data has been deleted.',
    deleteFailed: 'Deletion failed',

    // Self-moderation
    myPhotos: 'My photos',
    showPhotos: 'Show',
    hidePhotos: 'Hide',
    pendingApproval: 'Pending approval',
    selected: 'selected',
    deleteSelected: 'Delete selected',
    confirmDeleteSelected: 'Delete selected photos?',
    deletedSelected: 'Selected photos deleted.',
    clearSelection: 'Clear selection',
    deleteAllMyData: 'Delete ALL my data',
    confirmDeleteAllMyData: 'Delete ALL your files and data?',

    // Preview
    tapToPreview: 'Click to preview',
    previewModalLabel: 'Photo preview',
    closePreview: 'Close preview',
  },
};

type LanguageContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (typeof translations)['el'];
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'el',
  setLang: () => {},
  t: translations.el,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('el');

  useEffect(() => {
    const saved = localStorage.getItem('wedding_lang') as Lang | null;
    if (saved === 'el' || saved === 'en') {
      setLangState(saved);
    } else if (typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('el')) {
      setLangState('en');
    }
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('wedding_lang', newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-full bg-white/90 backdrop-blur border border-stone-200 p-0.5 text-xs font-medium shadow-xs">
      <button
        type="button"
        onClick={() => setLang('el')}
        className={`px-2.5 py-1 rounded-full transition cursor-pointer focus:ring-2 focus:ring-stone-500 focus:outline-none ${
          lang === 'el' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
        }`}
      >
        EL
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-full transition cursor-pointer focus:ring-2 focus:ring-stone-500 focus:outline-none ${
          lang === 'en' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
        }`}
      >
        EN
      </button>
    </div>
  );
}