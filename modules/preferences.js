export const LARGE_TEXT_KEY = "mrbdProbe.largeText";

export function parseBooleanPreference(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function shouldUseLargeText({ storedPreference = null, width, height, userAgent = "" }) {
  const preference = parseBooleanPreference(storedPreference);
  if (preference !== null) return preference;
  return width <= 600 || height <= 600 || /Greatwhite/i.test(userAgent);
}

export function readLargeTextPreference(storage) {
  try {
    return storage.getItem(LARGE_TEXT_KEY);
  } catch {
    return null;
  }
}

export function writeLargeTextPreference(storage, enabled) {
  storage.setItem(LARGE_TEXT_KEY, String(Boolean(enabled)));
}
