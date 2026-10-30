import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_STORE_CHUNK_SIZE = 1800;

export const mobileSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(key) ?? null;
    }

    const chunkCount = await readChunkCount(key);
    if (chunkCount === 0) return SecureStore.getItemAsync(key);

    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );
    return chunks.every((chunk) => chunk !== null) ? chunks.join('') : null;
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }

    const chunkCount = await readChunkCount(key);
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(metadataKey(key)),
      ...Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
    ]);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }

    const previousChunkCount = await readChunkCount(key);
    const chunks = Array.from(
      { length: Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE) },
      (_, index) =>
        value.slice(
          index * SECURE_STORE_CHUNK_SIZE,
          (index + 1) * SECURE_STORE_CHUNK_SIZE,
        ),
    );

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(metadataKey(key), String(chunks.length));
    await SecureStore.deleteItemAsync(key);

    await Promise.all(
      Array.from(
        { length: Math.max(0, previousChunkCount - chunks.length) },
        (_, offset) =>
          SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset)),
      ),
    );
  },
};

function chunkKey(key: string, index: number): string {
  return `${key}--chunk-${index}`;
}

function metadataKey(key: string): string {
  return `${key}--chunks`;
}

async function readChunkCount(key: string): Promise<number> {
  const value = await SecureStore.getItemAsync(metadataKey(key));
  if (!value) return 0;
  const count = Number.parseInt(value, 10);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}
