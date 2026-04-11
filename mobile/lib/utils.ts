import { API_BASE_URL } from './config';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const MEDIA_PROXY_HOSTS = new Set([
  'images.pexels.com',
  'images.unsplash.com',
  'plus.unsplash.com',
  'source.unsplash.com',
]);

const getApiOrigin = () => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return String(API_BASE_URL || '').replace(/\/+$/, '');
  }
};

const joinBase = (base: string, path: string) => {
  const cleanBase = String(base || '').replace(/\/+$/, '');
  const cleanPath = String(path || '').replace(/^\/+/, '');
  if (!cleanBase) return `/${cleanPath}`;
  return `${cleanBase}/${cleanPath}`;
};

export function resolvePhoto(url?: string | null) {
  if (!url) return '';
  const raw = String(url).trim().replace(/\\/g, '/');
  const base = getApiOrigin();
  const baseUrl = (() => {
    try {
      return new URL(base);
    } catch {
      return null;
    }
  })();

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const shouldRewriteLocalHost = LOCAL_HOSTS.has(parsed.hostname);
      const shouldRewriteUploadsFromOtherOrigin =
        !!baseUrl && parsed.pathname.startsWith('/uploads/') && parsed.origin !== baseUrl.origin;
      if ((shouldRewriteLocalHost || shouldRewriteUploadsFromOtherOrigin) && base) {
        return `${joinBase(base, parsed.pathname)}${parsed.search}${parsed.hash}`;
      }

      // Route known image CDNs through local backend proxy to avoid device-side network quirks.
      if (base && MEDIA_PROXY_HOSTS.has(parsed.hostname)) {
        return `${joinBase(base, '/media-proxy')}?url=${encodeURIComponent(raw)}`;
      }
    } catch {
      // Keep raw value when URL parsing fails.
    }
    return raw;
  }

  return base ? joinBase(base, raw) : raw;
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
