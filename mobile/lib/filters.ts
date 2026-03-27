import * as SecureStore from 'expo-secure-store';

export type Filters = {
  ageMin?: string;
  ageMax?: string;
  city?: string;
  children?: string;
  smoker?: string;
  religion?: string;
};

const FILTERS_KEY = 'ndololy_filters';

export async function getFilters(): Promise<Filters> {
  const raw = await SecureStore.getItemAsync(FILTERS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function setFilters(filters: Filters) {
  await SecureStore.setItemAsync(FILTERS_KEY, JSON.stringify(filters));
}

export async function clearFilters() {
  await SecureStore.deleteItemAsync(FILTERS_KEY);
}
