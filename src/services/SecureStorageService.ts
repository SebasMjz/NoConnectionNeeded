/**
 * SecureStorageService.ts
 *
 * Wraps @capacitor/preferences for secure(r) key-value storage on Android.
 * On native platforms, @capacitor/preferences uses Android EncryptedSharedPreferences
 * (backed by the Android Keystore), which is significantly more secure than localStorage.
 *
 * On web, it falls back to localStorage (same behavior as before).
 *
 * Usage:
 *   import SecureStorage from './SecureStorageService';
 *   await SecureStorage.set('my_key', 'my_value');
 *   const val = await SecureStorage.get('my_key');
 *   await SecureStorage.remove('my_key');
 */

import { Capacitor } from '@capacitor/core';

interface StorageBackend {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** localStorage backend (web fallback) */
const localStorageBackend: StorageBackend = {
  async set(key, value) { localStorage.setItem(key, value); },
  async get(key) { return localStorage.getItem(key); },
  async remove(key) { localStorage.removeItem(key); },
  async clear() { localStorage.clear(); },
};

/** @capacitor/preferences backend (Android Keystore-backed) */
const capacitorBackend: StorageBackend = {
  async set(key, value) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  },
  async get(key) {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  },
  async remove(key) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
  },
  async clear() {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.clear();
  },
};

function getBackend(): StorageBackend {
  return Capacitor.isNativePlatform() ? capacitorBackend : localStorageBackend;
}

const SecureStorage = {
  /** Store a value. For sensitive data (secret keys), prefix key with 'secure_' */
  async set(key: string, value: string): Promise<void> {
    return getBackend().set(key, value);
  },

  /** Retrieve a value. Returns null if not found. */
  async get(key: string): Promise<string | null> {
    return getBackend().get(key);
  },

  /** Store a JSON object */
  async setJSON<T>(key: string, value: T): Promise<void> {
    return getBackend().set(key, JSON.stringify(value));
  },

  /** Retrieve and parse a JSON object */
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await getBackend().get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    return getBackend().remove(key);
  },

  async clear(): Promise<void> {
    return getBackend().clear();
  },

  /** Whether running on a native platform with encrypted storage */
  get isSecure(): boolean {
    return Capacitor.isNativePlatform();
  },
};

export default SecureStorage;
