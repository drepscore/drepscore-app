/**
 * Application constants
 */

function getBaseUrl(): string {
  // Explicit site URL takes precedence (for custom domains)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Vercel deployment URL (doesn't include protocol)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Local development fallback
  return 'http://localhost:3000';
}

export const BASE_URL = getBaseUrl();
