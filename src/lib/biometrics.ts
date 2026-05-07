import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRICS_KEY = 'swapify_biometrics_enabled';
const STORED_EMAIL_KEY = 'swapify_stored_email';
const STORED_PASS_KEY = 'swapify_stored_pass';

export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
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
    await LocalAuthentication.cancelAuthenticate();
  } catch {}

  await new Promise(r => setTimeout(r, 600));

  try {
    const faceID = await isFaceIDAvailable();
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: faceID ? 'Verify with Face ID' : 'Verify with Fingerprint',
      disableDeviceFallback: false,
      fallbackLabel: '',
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
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
  } catch {}
}

// Save credentials securely for biometric re-login
export async function saveCredentialsForBiometrics(
  email: string,
  password: string,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORED_EMAIL_KEY, email);
    await SecureStore.setItemAsync(STORED_PASS_KEY, password);
  } catch {}
}

// Retrieve stored credentials
export async function getStoredCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  try {
    const email = await SecureStore.getItemAsync(STORED_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(STORED_PASS_KEY);
    if (email && password) return { email, password };
    return null;
  } catch {
    return null;
  }
}

// Clear stored credentials (on logout / account delete)
export async function clearStoredCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORED_EMAIL_KEY);
    await SecureStore.deleteItemAsync(STORED_PASS_KEY);
  } catch {}
}

export async function isBiometricsEnabledForUser(): Promise<boolean> {
  try {
    const enabled = await getBiometricsEnabled();
    if (!enabled) return false;
    return await isBiometricsAvailable();
  } catch {
    return false;
  }
}

export async function syncBiometricsToProfile(
  userId: string,
  enabled: boolean,
): Promise<void> {
  try {
    const { supabase } = await import('./supabase');
    await supabase
      .from('profiles')
      .update({ biometric_enabled: enabled })
      .eq('id', userId);
  } catch {}
}