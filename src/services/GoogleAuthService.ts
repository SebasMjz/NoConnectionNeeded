/**
 * GoogleAuthService.ts
 *
 * Wraps @codetrix-studio/capacitor-google-auth for native Android Google Sign-In.
 * Falls back gracefully to a web-based simulated OAuth when running in browser.
 *
 * Usage:
 *   import GoogleAuthService from './GoogleAuthService';
 *   const profile = await GoogleAuthService.signIn();
 */

import { Capacitor } from '@capacitor/core';

export interface GoogleProfile {
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  avatar?: string;       // photoUrl
  idToken?: string;
  accessToken?: string;
  provider: 'google';
}

class _GoogleAuthService {
  private initialized = false;
  private plugin: any = null;

  /**
   * Lazily load the Capacitor Google Auth plugin only on native platforms
   * to avoid bundling issues in web-only environments.
   */
  private async ensurePlugin(): Promise<any> {
    if (this.plugin) return this.plugin;
    try {
      const mod = await import('@codetrix-studio/capacitor-google-auth');
      this.plugin = mod.GoogleAuth;
      return this.plugin;
    } catch (e) {
      console.warn('[GoogleAuthService] Plugin not available:', e);
      return null;
    }
  }

  /**
   * Initialize the Google Auth plugin (only needed on native platforms).
   * Reads clientId from capacitor.config.json via the plugin config system.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!Capacitor.isNativePlatform()) {
      this.initialized = true;
      return;
    }
    const GoogleAuth = await this.ensurePlugin();
    if (!GoogleAuth) return;
    await GoogleAuth.initialize();
    this.initialized = true;
  }

  /**
   * Launch the native Google Sign-In flow (Android) or return null (web fallback).
   * Returns a normalized profile or null if cancelled.
   */
  async signIn(): Promise<GoogleProfile | null> {
    await this.initialize();

    if (Capacitor.isNativePlatform()) {
      return this.nativeSignIn();
    }

    // In browser context: resolve immediately with null
    // The caller (AuthGateway) will open OAuthModal instead
    return null;
  }

  private async nativeSignIn(): Promise<GoogleProfile | null> {
    const GoogleAuth = await this.ensurePlugin();
    if (!GoogleAuth) throw new Error('Google Auth plugin no disponible');

    try {
      const user = await GoogleAuth.signIn();
      return {
        email: user.email,
        name: user.displayName || user.name || user.email.split('@')[0],
        givenName: user.givenName,
        familyName: user.familyName,
        avatar: user.imageUrl || user.photoUrl,
        idToken: user.authentication?.idToken,
        accessToken: user.authentication?.accessToken,
        provider: 'google',
      };
    } catch (err: any) {
      if (err?.error === 'SIGN_IN_CANCELLED' || err?.message?.includes('cancel')) {
        return null; // user cancelled — not an error
      }
      throw err;
    }
  }

  /**
   * Sign out from Google (native only).
   */
  async signOut(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const GoogleAuth = await this.ensurePlugin();
    if (!GoogleAuth) return;
    try {
      await GoogleAuth.signOut();
    } catch (e) {
      console.warn('[GoogleAuthService] Sign out error:', e);
    }
  }

  /** True when running inside a real Android/iOS app */
  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }
}

const GoogleAuthService = new _GoogleAuthService();
export default GoogleAuthService;
