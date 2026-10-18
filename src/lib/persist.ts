// Small helper for values that should survive closing the app (saved on the device).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePersisted<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(`muslim.${key}`)
      .then((raw) => {
        if (alive && raw != null) setValue(merge(initialRef.current, JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        AsyncStorage.setItem(`muslim.${key}`, JSON.stringify(v)).catch(() => {});
        return v;
      }),
    [key],
  );
  return [value, update, loaded];
}

// Saved objects are merged over their defaults, so fields added in a later version still get a value.
function merge<T>(initial: T, saved: unknown): T {
  const isObj = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x);
  return isObj(initial) && isObj(saved) ? ({ ...(initial as object), ...(saved as object) } as T) : (saved as T);
}

/** Local date as YYYY-MM-DD, used to reset daily checklists. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
