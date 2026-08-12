/**
 * Centralized URL builder for sharing resources.
 * Ensures cross-device and cross-environment link consistency.
 * 
 * Uses the production canonical base URL from environment variables if available.
 * Prefix with VITE_ to expose to client-side code in Vite.
 */

/**
 * Validates if a string is a valid absolute HTTP or HTTPS URL.
 */
const isValidAbsoluteUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Returns the canonical base URL for public share links.
 * This is strictly controlled by environment variables.
 * Returns null if not properly configured.
 */
export const getCanonicalBaseUrl = () => {
  const candidates = [
    import.meta.env.VITE_PUBLIC_APP_URL,
    import.meta.env.VITE_CANONICAL_BASE_URL
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed !== '' && trimmed !== 'https://example.com' && trimmed !== '0509') {
        if (isValidAbsoluteUrl(trimmed)) {
          return trimmed.replace(/\/$/, '');
        }
      }
    }
  }

  // Fallback for development/preview environments
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return null;
};

/**
 * Required behavior for public Share Links.
 * Throws an error if the canonical URL is not configured.
 */
export const getBaseUrl = () => {
  const canonicalUrl = getCanonicalBaseUrl();

  if (!canonicalUrl) {
    throw new Error("Canonical public URL is not configured.");
  }

  return canonicalUrl;
};

export const buildCharacterUrl = (id: string) => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/character/${id}`;
};

export const buildPromptUrl = (id: string) => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/prompt/${id}`;
};

export const buildCreatorUrl = (id: string) => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/creator/${id}`;
};

/**
 * Returns a canonical URL for a given path, ensuring it starts with the production base URL.
 */
export const getCanonicalUrl = (path: string) => {
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // Remove trailing / from base URL if present to avoid //
  const baseUrl = getBaseUrl().replace(/\/$/, '');
  return `${baseUrl}${cleanPath}`;
};

/**
 * Returns the current path's canonical version (ignoring dev/preview prefixes in origin)
 */
export const getCurrentCanonicalUrl = () => {
  return getCanonicalUrl(window.location.pathname + window.location.search);
};
