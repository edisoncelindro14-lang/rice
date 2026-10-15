// Device-local saved login credentials (localStorage).
// Stores multiple credentials keyed by username so a returning user can
// tap a saved tag to autofill the form without retyping.

const STORAGE_KEY = "mlm_saved_credentials";
const MAX_SAVED = 20;

export function getSavedCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCredentials(username, password) {
  if (!username || !password) return;
  const list = getSavedCredentials().filter(c => c.username !== username);
  list.unshift({ username, password });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

export function removeCredentials(username) {
  const list = getSavedCredentials().filter(c => c.username !== username);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
