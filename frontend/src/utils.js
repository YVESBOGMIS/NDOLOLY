const apiUrl = import.meta.env.VITE_API_URL || "";

const STAFF_NAME_PATTERN = /\b(admin|backoffice)\b/i;
const STAFF_META_PATTERN = /\b(admin|backoffice|moderation|administration|staff|support)\b/i;

export const resolvePhoto = (path) => {
  if (!path) return "";
  const raw = String(path);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = apiUrl || origin;
  const joinBase = (b, p) => `${b}${p.startsWith("/") ? p : `/${p}`}`;

  if (/^https?:\/\//i.test(raw)) {
    // If backend returned localhost URLs, rewrite to the current host (works on phone + Vite proxy).
    try {
      const url = new URL(raw);
      if (["localhost", "127.0.0.1", "::1"].includes(url.hostname) && base) {
        return `${joinBase(base, url.pathname)}${url.search}${url.hash}`;
      }
    } catch {
      // If URL parsing fails, keep original.
    }
    return raw;
  }

  return base ? joinBase(base, raw) : raw;
};

export const isPrivateStaffProfile = (profile) => {
  if (!profile || typeof profile !== "object") return false;
  if (String(profile.role || "").toLowerCase() === "admin") return true;

  const name = String(profile.name || "");
  const location = String(profile.location || "");
  const gender = String(profile.gender || "");
  const profession = String(profile.profession || "");
  const education = String(profile.education_level || "");
  const bio = String(profile.bio || "");

  return STAFF_NAME_PATTERN.test(name)
    || STAFF_META_PATTERN.test(location)
    || STAFF_META_PATTERN.test(gender)
    || STAFF_META_PATTERN.test(profession)
    || STAFF_META_PATTERN.test(education)
    || STAFF_META_PATTERN.test(bio);
};

export const sanitizePublicProfile = (profile) => {
  if (!profile || typeof profile !== "object") return null;
  return isPrivateStaffProfile(profile) ? null : profile;
};

export const sanitizePublicProfiles = (profiles) => (
  Array.isArray(profiles)
    ? profiles.map((profile) => sanitizePublicProfile(profile)).filter(Boolean)
    : []
);

export const sanitizePublicMatches = (matches) => (
  Array.isArray(matches)
    ? matches.filter((item) => !isPrivateStaffProfile(item?.user))
    : []
);
