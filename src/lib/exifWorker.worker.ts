import exifr from 'exifr';

type ExifWorkerMessage = {
  type: 'parse';
  file: File;
  id: string;
};

type ExifWorkerResponse = {
  type: 'result';
  id: string;
  takenAt: string | null;
  error?: string;
};

self.onmessage = async (e: MessageEvent<ExifWorkerMessage>) => {
  const { file, id } = e.data;

  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal']);
    let takenAt: string | null = null;
    if (exif?.DateTimeOriginal) {
      takenAt = new Date(exif.DateTimeOriginal).toISOString();
    }
    if (!takenAt && file.lastModified) {
      takenAt = new Date(file.lastModified).toISOString();
    }

    const response: ExifWorkerResponse = { type: 'result', id, takenAt };
    self.postMessage(response);
  } catch (err) {
    const response: ExifWorkerResponse = {
      type: 'result',
      id,
      takenAt: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
    self.postMessage(response);
  }
};

export {};