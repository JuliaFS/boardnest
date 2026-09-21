export function clearLegacySupabaseAuthStorage(
  storage: Storage = window.localStorage,
): void {
  const keys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  ).filter((key): key is string => key !== null);

  for (const key of keys) {
    if (key.startsWith('sb-') && key.includes('-auth-token')) {
      storage.removeItem(key);
    }
  }
}
