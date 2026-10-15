const STORAGE_KEY = "mlm_member_id";
const SAVED_KEY = "pp_saved_credentials";

export function saveMemberSession(id) {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearMemberSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getSessionMemberId() {
  return localStorage.getItem(STORAGE_KEY);
}

// --- Device-saved credentials for quick re-login ---

export function loadSavedCredentials() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCredentials(username, password) {
  const existing = loadSavedCredentials();
  const filtered = existing.filter(c => c.username !== username);
  filtered.push({ username, password });
  localStorage.setItem(SAVED_KEY, JSON.stringify(filtered));
  return filtered;
}
