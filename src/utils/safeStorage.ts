class SafeMemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

function getSafeStorage(type: 'localStorage' | 'sessionStorage'): Storage {
  try {
    if (typeof window !== 'undefined') {
      const storage = window[type];
      if (storage) {
        // Test write and read to ensure storage is fully operational and not blocked
        const testKey = '__storage_test__';
        storage.setItem(testKey, testKey);
        storage.removeItem(testKey);
        return storage;
      }
    }
  } catch (e) {
    // Access is blocked/unauthorized (e.g., inside restricted iframe sandboxes)
  }
  return new SafeMemoryStorage() as unknown as Storage;
}

export const safeLocalStorage = getSafeStorage('localStorage');
export const safeSessionStorage = getSafeStorage('sessionStorage');
