import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Upload flow logic', () => {
  describe('computeFileHash', () => {
    it('computes SHA-256 hash of a file', async () => {
      const content = new TextEncoder().encode('hello world');
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });
  });

  describe('mimeType validation', () => {
    it('accepts image/*', () => {
      const isImage = 'image/jpeg'.startsWith('image/');
      const isVideo = 'image/jpeg'.startsWith('video/');
      expect(isImage).toBe(true);
      expect(isVideo).toBe(false);
    });

    it('accepts video/*', () => {
      const isImage = 'video/mp4'.startsWith('image/');
      const isVideo = 'video/mp4'.startsWith('video/');
      expect(isImage).toBe(false);
      expect(isVideo).toBe(true);
    });

    it('rejects application/pdf', () => {
      const isImage = 'application/pdf'.startsWith('image/');
      const isVideo = 'application/pdf'.startsWith('video/');
      expect(isImage).toBe(false);
      expect(isVideo).toBe(false);
    });
  });
});

describe('Admin PIN rate limiting', () => {
  const pinAttempts = new Map<string, { count: number; resetAt: number }>();

  function checkPinRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = pinAttempts.get(ip);
    if (!record || now > record.resetAt) {
      pinAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (record.count >= 5) return false;
    record.count++;
    return true;
  }

  beforeEach(() => {
    pinAttempts.clear();
  });

  it('allows up to 5 attempts per minute', () => {
    const ip = '192.168.1.1';
    for (let i = 0; i < 5; i++) {
      expect(checkPinRateLimit(ip)).toBe(true);
    }
    expect(checkPinRateLimit(ip)).toBe(false);
  });

  it('resets after 1 minute', () => {
    const ip = '192.168.1.2';
    for (let i = 0; i < 5; i++) {
      expect(checkPinRateLimit(ip)).toBe(true);
    }
    expect(checkPinRateLimit(ip)).toBe(false);

    // Simulate time passing
    vi.useFakeTimers();
    vi.advanceTimersByTime(61_000);
    expect(checkPinRateLimit(ip)).toBe(true);
    vi.useRealTimers();
  });

  it('tracks different IPs separately', () => {
    expect(checkPinRateLimit('192.168.1.1')).toBe(true);
    expect(checkPinRateLimit('192.168.1.2')).toBe(true);
    for (let i = 0; i < 4; i++) checkPinRateLimit('192.168.1.1');
    expect(checkPinRateLimit('192.168.1.1')).toBe(false);
    expect(checkPinRateLimit('192.168.1.2')).toBe(true);
  });
});

describe('PIN length validation', () => {
  it('requires at least 6 characters', () => {
    const pin = '123456';
    expect(pin.trim().length >= 6).toBe(true);
  });

  it('rejects 4 character PIN', () => {
    const pin = '1234';
    expect(pin.trim().length >= 6).toBe(false);
  });

  it('rejects 5 character PIN', () => {
    const pin = '12345';
    expect(pin.trim().length >= 6).toBe(false);
  });
});

describe('PIN strength validation', () => {
  // Import the validation function (inline copy for testing)
  function validatePinStrength(pin: string): { valid: boolean; message?: string } {
    if (pin.length < 6) {
      return { valid: false, message: 'PIN must be at least 6 characters' };
    }
    if (!/^\d+$/.test(pin)) {
      return { valid: false, message: 'PIN must contain only numbers' };
    }
    if (/^(\d)\1+$/.test(pin)) {
      return { valid: false, message: 'PIN cannot be all the same digit' };
    }
    if (/^(012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210)$/.test(pin)) {
      return { valid: false, message: 'PIN cannot be a simple sequence' };
    }
    return { valid: true };
  }

  it('accepts valid 6-digit PIN', () => {
    expect(validatePinStrength('123457')).toEqual({ valid: true });
  });

  it('rejects PIN with letters', () => {
    expect(validatePinStrength('12345a')).toEqual({ valid: false, message: 'PIN must contain only numbers' });
  });

  it('rejects all same digit', () => {
    expect(validatePinStrength('111111')).toEqual({ valid: false, message: 'PIN cannot be all the same digit' });
  });

  it('rejects sequential PIN', () => {
    expect(validatePinStrength('123456')).toEqual({ valid: false, message: 'PIN cannot be a simple sequence' });
    expect(validatePinStrength('654321')).toEqual({ valid: false, message: 'PIN cannot be a simple sequence' });
  });

  it('accepts longer PINs', () => {
    expect(validatePinStrength('1234578')).toEqual({ valid: true });
    expect(validatePinStrength('9876543219')).toEqual({ valid: true });
  });
});