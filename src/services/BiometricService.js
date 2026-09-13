import { Capacitor } from '@capacitor/core';

let CapacitorNativeBiometric = null;
async function getNativeBiometric() {
  if (CapacitorNativeBiometric) return CapacitorNativeBiometric;
  if (Capacitor.isNativePlatform()) {
    try {
      const mod = await import('capacitor-native-biometric');
      CapacitorNativeBiometric = mod.NativeBiometric;
    } catch (e) {
      console.warn('NativeBiometric load error:', e);
    }
  }
  return CapacitorNativeBiometric;
}

const BIOMETRIC_CREDS_KEY = 'pollar_biometric_creds';

export class BiometricAuthService {
  constructor() {
    this.isAvailable = false;
    this._platform = null; // 'mobile' | 'web'
  }

  /**
   * Initialize and detect biometric availability.
   */
  async initialize() {
    // Try mobile plugin first
    const nativeBio = await getNativeBiometric();
    if (nativeBio) {
      try {
        const result = await nativeBio.isAvailable();
        if (result.isAvailable) {
          this._platform = 'mobile';
          this.isAvailable = true;
          console.log('[Biometric] Native biometric available (mobile)');
          return true;
        }
      } catch (e) {
        console.log('[Biometric] Native biometric not available:', e.message);
      }
    }

    // Fallback: WebAuthn
    if (typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          this._platform = 'web';
          this.isAvailable = true;
          console.log('[Biometric] WebAuthn available');
          return true;
        }
      } catch {
        // Not available
      }
    }

    console.warn('[Biometric] No biometric method available');
    this.isAvailable = false;
    return false;
  }

  /**
   * Check if biometric auth is supported on this device.
   */
  static isBiometricSupported() {
    return typeof window !== 'undefined' && window.PublicKeyCredential && !!navigator.credentials;
  }

  /**
   * Register biometric auth for the current user.
   * On mobile: stores a token that can be used for later verification.
   * On web: uses WebAuthn to create a credential.
   */
  async registerBiometric(userId) {
    if (!this.isAvailable) {
      await this.initialize();
    }
    if (!this.isAvailable) {
      throw new Error('Biometría no disponible en este dispositivo');
    }

    if (this._platform === 'mobile') {
      try {
        const nativeBio = await getNativeBiometric();
        if (!nativeBio) throw new Error('Plugin biométrico no disponible');
        // Verify first (user must authenticate to enable biometric)
        await nativeBio.verifyIdentity({
          reason: 'Habilitar inicio de sesión con biometría',
          title: 'Pollar P2P',
          subtitle: 'Verifica tu identidad',
        });

        // Store credentials for later login
        const creds = JSON.parse(localStorage.getItem(BIOMETRIC_CREDS_KEY) || '{}');
        creds[userId] = {
          userId,
          createdAt: Date.now(),
          platform: 'mobile',
        };
        localStorage.setItem(BIOMETRIC_CREDS_KEY, JSON.stringify(creds));
        return true;
      } catch (err) {
        if (err.message?.includes('User cancelled') || err.message?.includes('cancelled')) {
          throw new Error('Autenticación cancelada');
        }
        throw new Error('No se pudo registrar biometría: ' + (err.message || 'error desconocido'));
      }
    } else if (this._platform === 'web') {
      // WebAuthn registration
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userIdBuffer = new TextEncoder().encode(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: 'Pollar P2P', id: 'pollar.io' },
          user: { id: userIdBuffer, name: userId, displayName: userId },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        }
      });

      const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      const creds = JSON.parse(localStorage.getItem(BIOMETRIC_CREDS_KEY) || '{}');
      creds[userId] = { credentialId: credId, createdAt: Date.now(), platform: 'web' };
      localStorage.setItem(BIOMETRIC_CREDS_KEY, JSON.stringify(creds));
      return true;
    }

    throw new Error('Método biométrico no soportado');
  }

  /**
   * Authenticate with biometric.
   */
  async authenticateWithBiometric(userId) {
    if (!this.isAvailable) {
      await this.initialize();
    }
    if (!this.isAvailable) {
      throw new Error('Biometría no disponible');
    }

    if (this._platform === 'mobile') {
      try {
        const nativeBio = await getNativeBiometric();
        if (!nativeBio) throw new Error('Plugin biométrico no disponible');
        await nativeBio.verifyIdentity({
          reason: 'Iniciar sesión con biometría',
          title: 'Pollar P2P',
          subtitle: 'Verifica tu identidad para continuar',
        });
        return true;
      } catch (err) {
        if (err.message?.includes('User cancelled') || err.message?.includes('cancelled')) {
          throw new Error('Autenticación cancelada');
        }
        throw new Error('No se pudo autenticar: ' + (err.message || 'error desconocido'));
      }
    } else if (this._platform === 'web') {
      const creds = JSON.parse(localStorage.getItem(BIOMETRIC_CREDS_KEY) || '{}');
      const stored = creds[userId];
      if (!stored) {
        throw new Error('No hay credencial biométrica registrada');
      }

      const credIdBuffer = Uint8Array.from(atob(stored.credentialId), c => c.charCodeAt(0));
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          allowCredentials: [{ id: credIdBuffer, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000,
        }
      });

      if (!assertion) throw new Error('Autenticación cancelada');
      return true;
    }

    throw new Error('Método biométrico no soportado');
  }

  /**
   * Remove biometric credentials for a user.
   */
  async removeBiometric(userId) {
    const creds = JSON.parse(localStorage.getItem(BIOMETRIC_CREDS_KEY) || '{}');
    delete creds[userId];
    localStorage.setItem(BIOMETRIC_CREDS_KEY, JSON.stringify(creds));
  }
}

// Singleton
let instance = null;
export function getBiometricService() {
  if (!instance) {
    instance = new BiometricAuthService();
  }
  return instance;
}

export default BiometricAuthService;
