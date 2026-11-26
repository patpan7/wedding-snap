export interface ExifWorkerMessage {
  type: 'parse';
  file: File;
  id: string;
}

export interface ExifWorkerResponse {
  type: 'result';
  id: string;
  takenAt: string | null;
  error?: string;
}

class ExifWorkerManager {
  private worker: Worker | null = null;
  private pending = new Map<string, (result: string | null) => void>();
  private idCounter = 0;

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    if (typeof window === 'undefined') {
      throw new Error('ExifWorker only works in browser');
    }

    this.worker = new Worker(
      new URL('./exifWorker.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent<ExifWorkerResponse>) => {
      const { id, takenAt, error } = e.data;
      const resolver = this.pending.get(id);
      if (resolver) {
        this.pending.delete(id);
        if (error) {
          console.error('EXIF worker error:', error);
          resolver(null);
        } else {
          resolver(takenAt);
        }
      }
    };

    return this.worker;
  }

  async parseDateTimeOriginal(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const id = `${Date.now()}-${this.idCounter++}`;
      this.pending.set(id, resolve);

      this.getWorker().postMessage(
        { type: 'parse', file, id } as ExifWorkerMessage,
        [file]
      );

      // Fallback timeout
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(null);
        }
      }, 5000);
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

export const exifWorker = new ExifWorkerManager();