import { API_BASE_URL } from './config';

export function resolvePhoto(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}

const STAFF_NAME_PATTERN = /\b(admin|backoffice)\b/i;
const STAFF_META_PATTERN = /\b(admin|backoffice|moderation|administration|staff|support)\b/i;

export function isPrivateStaffProfile(profile?: Record<string, any> | null) {
  if (!profile || typeof profile !== 'object') return false;
  if (String(profile.role || '').toLowerCase() === 'admin') return true;

  const name = String(profile.name || '');
  const location = String(profile.location || '');
  const gender = String(profile.gender || '');
  const profession = String(profile.profession || '');
  const education = String(profile.education_level || '');
  const bio = String(profile.bio || '');

  return STAFF_NAME_PATTERN.test(name)
    || STAFF_META_PATTERN.test(location)
    || STAFF_META_PATTERN.test(gender)
    || STAFF_META_PATTERN.test(profession)
    || STAFF_META_PATTERN.test(education)
    || STAFF_META_PATTERN.test(bio);
}

export function sanitizePublicProfile<T extends Record<string, any>>(profile?: T | null): T | null {
  if (!profile || typeof profile !== 'object') return null;
  return isPrivateStaffProfile(profile) ? null : profile;
}

export function sanitizePublicProfiles<T extends Record<string, any>>(profiles?: T[] | null): T[] {
  return Array.isArray(profiles)
    ? profiles.map((profile) => sanitizePublicProfile(profile)).filter(Boolean) as T[]
    : [];
}

export function sanitizePublicMatches<T extends { user?: Record<string, any> | null }>(matches?: T[] | null): T[] {
  return Array.isArray(matches)
    ? matches.filter((match) => !isPrivateStaffProfile(match?.user || null))
    : [];
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
