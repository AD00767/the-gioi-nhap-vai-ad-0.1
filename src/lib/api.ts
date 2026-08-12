/**
 * Local API Proxy
 * Handles local requests without making network calls.
 */

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  // Simulate immediate local response for any legacy API call
  return { status: "ok", message: "Processed locally via LocalStorage" };
};
