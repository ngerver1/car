import { v5 as uuidv5, v7 as uuidv7 } from 'uuid';

/** New record id: UUID v7, created on the device (time-ordered). */
export const newId = (): string => uuidv7();

// Seed rows use deterministic UUID v5 ids so every device seeds identical ids
// and they never duplicate when devices sync.
const SEED_NAMESPACE = '6f1c3c2e-8b0a-4f43-9d2e-5c35a0b1e735';
export const seedId = (key: string): string => uuidv5(key, SEED_NAMESPACE);
