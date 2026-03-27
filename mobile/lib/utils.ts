import { API_BASE_URL } from './config';

export function resolvePhoto(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}

export function computeAge(birthdate?: string | null) {
  if (!birthdate) return '-';
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return '-';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}
