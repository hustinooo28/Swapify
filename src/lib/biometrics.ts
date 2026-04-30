import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRICS_KEY = 'swapify_biometrics_enabled';

export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return false;

    return true;
  } catch {
    return false;
  }
}

export async function isFaceIDAvailable(): Promise<boolean> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    // Cancel any existing auth session first
    await LocalAuthentication.cancelAuthenticate();
  } catch {}

  try {
    const faceID = await isFaceIDAvailable();

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: faceID
        ? 'Use Face ID to sign in to Swapify'
        : 'Use your fingerprint to sign in to Swapify',
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false, // allow passcode as fallback on iOS
      requireConfirmation: false,   // faster on Android
    });

    return result.success;
  } catch (e) {
    console.error('Biometric auth error:', e);
    return false;
  }
}

export async function getBiometricsEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(BIOMETRICS_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(BIOMETRICS_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('SecureStore error:', e);
  }
}
export async function verifyBeforeDelete(): Promise<boolean> {
  try {
    const available = await isBiometricsAvailable();
    const enabled = await getBiometricsEnabled();

    if (available && enabled) {
      // Try biometrics first
      await new Promise(resolve => setTimeout(resolve, 300));
      const result = await authenticateWithBiometrics();
      return result;
    }
    // If biometrics not available/enabled, return true to let password verify handle it
    return true;
  } catch {
    return false;
  }
}