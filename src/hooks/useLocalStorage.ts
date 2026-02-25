import { useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'ad-gen:';
const DEBOUNCE_MS = 500;

// P3 FIX: strip large base64 images before saving to prevent localStorage bloat
function stripHeavyFields(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('backgroundImage' in obj && typeof obj.backgroundImage === 'string' && obj.backgroundImage.length > 1000) {
      const { backgroundImage: _, ...rest } = obj;
      void _;
      return rest;
    }
  }
  return value;
}

export function useSaveToStorage<T>(key: string, value: T): { dirty: boolean } {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isFirstRender = useRef(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setDirty(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const cleaned = stripHeavyFields(value);
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(cleaned));
      } catch {
        // Storage full or unavailable
      }
      setDirty(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [key, value]);

  return { dirty };
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function loadArrayFromStorage<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
