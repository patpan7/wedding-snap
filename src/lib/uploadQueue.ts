'use client';

import { computeFileHash } from './computeFileHash';
import { exifWorker } from './exifWorker';

export interface QueuedFile {
  file: File;
  fileHash: string;
  status: 'pending' | 'hashing' | 'presigning' | 'uploading' | 'completing' | 'done' | 'error';
  progress: number; // 0-100 for upload phase
  error?: string;
  retries: number;
  publicUrl?: string;
  takenAt?: string;
}

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000; // 1s, 2s, 4s

export async function processUploadQueue(
  files: File[],
  slug: string,
  guestId: string,
  guestName: string,
  wish: string,
  eventInfo: { allow_videos?: boolean } | null,
  onProgress: (queue: QueuedFile[]) => void,
  onComplete: (results: { done: number; errors: number }) => void,
  abortSignal: AbortSignal
) {
  const queue: QueuedFile[] = files.map((file) => ({
    file,
    fileHash: '',
    status: 'pending' as const,
    progress: 0,
    retries: 0,
  }));

  let wishSent = false;
  let doneCount = 0;
  let errorCount = 0;

  const updateQueue = () => onProgress([...queue]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const processFile = async (index: number) => {
    const item = queue[index];
    if (abortSignal.aborted) return;

    // 1. Hash
    item.status = 'hashing';
    updateQueue();
    try {
      item.fileHash = await computeFileHash(item.file);
    } catch (e) {
      item.status = 'error';
      item.error = 'Hash failed';
      updateQueue();
      return;
    }

    // 2. EXIF date (off main thread via worker)
    let takenAt: string | null = null;
    try {
      takenAt = await exifWorker.parseDateTimeOriginal(item.file);
    } catch {}
    if (!takenAt && item.file.lastModified) takenAt = new Date(item.file.lastModified).toISOString();

    // 3. Presign
    item.status = 'presigning';
    updateQueue();
    let presignData: { uploadUrl: string; fileKey: string; publicUrl: string; eventId: string } | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abortSignal.aborted) return;
      try {
        const res = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventSlug: slug,
            fileName: item.file.name,
            fileType: item.file.type || 'application/octet-stream',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.uploadUrl) throw new Error(data.error || 'Presign failed');
        presignData = data;
        break;
      } catch (e) {
        if (attempt === MAX_RETRIES) {
          item.status = 'error';
          item.error = 'Presign failed after retries';
          updateQueue();
          return;
        }
        await sleep(BASE_RETRY_DELAY * 2 ** attempt);
      }
    }

    // 4. Upload to R2
    item.status = 'uploading';
    item.progress = 0;
    updateQueue();

    // Since we can't track real upload progress with fetch PUT,
    // we simulate progress and update on complete
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abortSignal.aborted) return;
      try {
        const uploadRes = await fetch(presignData!.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': item.file.type || 'application/octet-stream' },
          body: item.file,
          signal: abortSignal,
        });
        if (!uploadRes.ok) throw new Error('R2 upload failed');
        item.progress = 100;
        break;
      } catch (e) {
        if (attempt === MAX_RETRIES) {
          item.status = 'error';
          item.error = 'Upload failed after retries';
          updateQueue();
          return;
        }
        await sleep(BASE_RETRY_DELAY * 2 ** attempt);
        item.progress = 0;
      }
    }

    // 5. Complete in DB
    item.status = 'completing';
    updateQueue();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abortSignal.aborted) return;
      try {
        const attachWish = !wishSent && wish.trim() ? wish.trim() : null;
        if (attachWish) wishSent = true;

        const res = await fetch('/api/upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: presignData!.eventId,
            fileKey: presignData!.fileKey,
            publicUrl: presignData!.publicUrl,
            fileHash: item.fileHash,
            mimeType: item.file.type || 'image/jpeg',
            guestId,
            guestName,
            wish: attachWish,
            takenAt,
          }),
        });
        if (!res.ok) throw new Error('Complete failed');
        break;
      } catch (e) {
        if (attempt === MAX_RETRIES) {
          item.status = 'error';
          item.error = 'DB registration failed';
          updateQueue();
          return;
        }
        await sleep(BASE_RETRY_DELAY * 2 ** attempt);
      }
    }

    item.status = 'done';
    item.publicUrl = presignData!.publicUrl;
    item.takenAt = takenAt || undefined;
    doneCount++;
    updateQueue();
  };

  // Process 2 at a time
  const workers = Array.from({ length: 2 }, async (_, workerIndex) => {
    for (let i = workerIndex; i < queue.length; i += 2) {
      if (abortSignal.aborted) return;
      await processFile(i);
    }
  });

  await Promise.all(workers);

  queue.forEach((item) => {
    if (item.status === 'error') errorCount++;
  });

  onComplete({ done: doneCount, errors: errorCount });
}