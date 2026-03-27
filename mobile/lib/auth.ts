import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'lc_token';
const PENDING_CONTACT_KEY = 'ndololy_pending_contact';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export type PendingContact = {
  email?: string | null;
  phone?: string | null;
};

export async function setPendingContact(contact: PendingContact) {
  await SecureStore.setItemAsync(PENDING_CONTACT_KEY, JSON.stringify(contact));
}

export async function getPendingContact(): Promise<PendingContact | null> {
  const raw = await SecureStore.getItemAsync(PENDING_CONTACT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearPendingContact() {
  await SecureStore.deleteItemAsync(PENDING_CONTACT_KEY);
}

