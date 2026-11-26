import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function validatePinStrength(pin: string): { valid: boolean; message?: string } {
  if (pin.length < 6) {
    return { valid: false, message: 'PIN must be at least 6 characters' };
  }
  if (!/^\d+$/.test(pin)) {
    return { valid: false, message: 'PIN must contain only numbers' };
  }
  // Check for common patterns
  if (/^(\d)\1+$/.test(pin)) {
    return { valid: false, message: 'PIN cannot be all the same digit' };
  }
  if (/^(012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210)$/.test(pin)) {
    return { valid: false, message: 'PIN cannot be a simple sequence' };
  }
  return { valid: true };
}