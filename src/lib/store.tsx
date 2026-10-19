// App-wide state: language, AI settings and favorites, saved on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './data';
import { STRINGS, type StringKey } from './i18n';
import { usePersisted } from './persist';
import { DEFAULT_PRAYER, type PrayerSettings } from './prayer';

export type LastRead = { s: number; a: number } | null;

export type AiSettings = {
  preset?: string;
  provider: 'ollama' | 'openai';
  baseUrl: string;
  model: string;
  apiKey: string;
};

export const DEFAULT_AI: AiSettings = {
  preset: 'ollama-local',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:3b',
  apiKey: '',
};

export type Favorite = {
  key: string; // q:2:255 | h:bukhari:6405 | d:42:0
  folder: string;
  title: string;
  ar: string;
  en: string;
  source: string;
  note?: string;
  added: number;
};

type Store = {
  ready: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: StringKey, vars?: Record<string, string | number>) => string;
  ai: AiSettings;
  setAi: (s: AiSettings) => void;
  favorites: Favorite[];
  folders: string[];
  addFavorite: (f: Omit<Favorite, 'added'>) => void;
  removeFavorite: (key: string, folder?: string) => void;
  addFolder: (name: string) => void;
  removeFolder: (name: string) => void;
  isFavorite: (key: string) => boolean;
  prayer: PrayerSettings;
  setPrayer: (p: PrayerSettings) => void;
  lastRead: LastRead;
  setLastRead: (r: LastRead) => void;
};

const Ctx = createContext<Store | null>(null);
const K = { lang: 'muslim.lang', ai: 'muslim.ai', favs: 'muslim.favorites', folders: 'muslim.folders' };
export const DEFAULT_FOLDERS = ['Duas', 'Ayat', 'Hadith'];

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState<Lang>('en');
  const [ai, setAiState] = useState<AiSettings>(DEFAULT_AI);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [folders, setFolders] = useState<string[]>(DEFAULT_FOLDERS);
  const [prayer, setPrayer] = usePersisted<PrayerSettings>('prayer', DEFAULT_PRAYER);
  const [lastRead, setLastRead] = usePersisted<LastRead>('lastRead', null);

  useEffect(() => {
    (async () => {
      setLangState(await read<Lang>(K.lang, 'en'));
      setAiState({ ...DEFAULT_AI, ...(await read<Partial<AiSettings>>(K.ai, {})) });
      setFavorites(await read<Favorite[]>(K.favs, []));
      setFolders(await read<string[]>(K.folders, DEFAULT_FOLDERS));
      setReady(true);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    write(K.lang, l);
  }, []);
  const setAi = useCallback((s: AiSettings) => {
    setAiState(s);
    write(K.ai, s);
  }, []);
  const updateFavs = useCallback((fn: (f: Favorite[]) => Favorite[]) => {
    setFavorites((prev) => {
      const next = fn(prev);
      write(K.favs, next);
      return next;
    });
  }, []);
  const updateFolders = useCallback((fn: (f: string[]) => string[]) => {
    setFolders((prev) => {
      const next = fn(prev);
      write(K.folders, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (k: StringKey, vars?: Record<string, string | number>) => {
      let s: string = STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
      for (const [name, v] of Object.entries(vars ?? {})) s = s.replace(`{${name}}`, String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      lang,
      setLang,
      t,
      ai,
      setAi,
      favorites,
      folders,
      addFavorite: (f) => {
        updateFavs((prev) => [{ ...f, added: Date.now() }, ...prev.filter((x) => !(x.key === f.key && x.folder === f.folder))]);
        updateFolders((prev) => (prev.includes(f.folder) ? prev : [...prev, f.folder]));
      },
      removeFavorite: (key, folder) =>
        updateFavs((prev) => prev.filter((x) => !(x.key === key && (folder == null || x.folder === folder)))),
      addFolder: (name) => updateFolders((prev) => (prev.includes(name) ? prev : [...prev, name])),
      removeFolder: (name) => {
        updateFolders((prev) => prev.filter((f) => f !== name));
        updateFavs((prev) => prev.filter((x) => x.folder !== name));
      },
      isFavorite: (key) => favorites.some((x) => x.key === key),
      prayer,
      setPrayer,
      lastRead,
      setLastRead,
    }),
    [ready, lang, setLang, t, ai, setAi, favorites, folders, updateFavs, updateFolders, prayer, setPrayer, lastRead, setLastRead],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
