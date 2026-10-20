import { useState, type ReactNode } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Share,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import type { GradeLevel } from '../lib/grades';
import { useStore, type Favorite } from '../lib/store';

export const C = {
  bg: '#F6F4EE',
  card: '#FFFFFF',
  text: '#1D2420',
  muted: '#5F6B64',
  border: '#E3DED2',
  primary: '#1E6B52',
  primarySoft: '#E3F0EA',
  gold: '#B8862B',
  goldSoft: '#F7EEDB',
  danger: '#B03A2E',
  dangerSoft: '#F8E3E0',
  warn: '#9A6A00',
  warnSoft: '#FFF3D6',
};

export const ARABIC_FONT = 'Amiri_400Regular';

/** Text that follows the UI language direction. */
export function T({ style, children, muted, bold, size }: { style?: StyleProp<TextStyle>; children: ReactNode; muted?: boolean; bold?: boolean; size?: number }) {
  const { lang } = useStore();
  return (
    <Text
      style={[
        { color: muted ? C.muted : C.text, fontSize: size ?? 15, lineHeight: (size ?? 15) * 1.45, textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: lang === 'ar' ? 'rtl' : 'ltr' },
        bold && { fontWeight: '700' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Arabic source text: always right-to-left in a Quranic font. */
export function Arabic({ children, size = 24, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <Text selectable style={[{ fontFamily: ARABIC_FONT, fontSize: size, lineHeight: size * 1.9, color: C.text, textAlign: 'right', writingDirection: 'rtl' }, style]}>
      {children}
    </Text>
  );
}

/** Translation / English source text: always left-to-right. */
export function English({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text selectable style={[{ fontSize: 15, lineHeight: 23, color: C.text, textAlign: 'left', writingDirection: 'ltr' }, style]}>
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={styles.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.inner, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.inner, { flex: 1 }, style]}>{children}</View>
      )}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', disabled, small }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; small?: boolean }) {
  const bg = kind === 'primary' ? C.primary : kind === 'danger' ? C.dangerSoft : C.primarySoft;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? C.danger : C.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: C.primary, borderColor: C.primary }]}>
      <Text style={{ color: active ? '#fff' : C.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, style]}>{children}</View>;
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  const { lang } = useStore();
  return (
    <TextInput
      placeholderTextColor={C.muted}
      {...props}
      style={[styles.input, { textAlign: lang === 'ar' ? 'right' : 'left' }, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]}
    />
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useStore();
  return (
    <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={C.primary} />
      <T muted>{label ?? t('loading')}</T>
    </View>
  );
}

/** Readable text for an error, with step-by-step help when the AI server cannot be reached. */
const AI_ERROR_TEXT = {
  AI_UNREACHABLE: 'aiUnreachable',
  AI_PHONE_LOCALHOST: 'aiPhoneLocalhost',
  AI_BLOCKED_BY_SITE: 'aiBlockedBySite',
  AI_BAD_KEY: 'aiBadKey',
  AI_RATE_LIMIT: 'aiRateLimit',
  AI_REFUSED: 'aiRefused',
} as const;

export function errorText(error: unknown, t: (k: (typeof AI_ERROR_TEXT)[keyof typeof AI_ERROR_TEXT]) => string): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg in AI_ERROR_TEXT ? t(AI_ERROR_TEXT[msg as keyof typeof AI_ERROR_TEXT]) : msg;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useStore();
  return (
    <Card style={{ backgroundColor: C.dangerSoft, borderColor: C.dangerSoft }}>
      <T bold>{t('error')}</T>
      <T muted>{errorText(error, t)}</T>
      {onRetry && <Button title={t('retry')} onPress={onRetry} kind="secondary" small />}
    </Card>
  );
}

const GRADE_COLORS: Record<GradeLevel, [string, string]> = {
  sahih: [C.primarySoft, C.primary],
  hasan: ['#E6F0F7', '#2C6A92'],
  daif: [C.warnSoft, C.warn],
  mawdu: [C.dangerSoft, C.danger],
  mixed: [C.warnSoft, C.warn],
  unknown: ['#EEEEEE', C.muted],
};

export function GradeBadge({ level }: { level: GradeLevel }) {
  const { t } = useStore();
  const [bg, fg] = GRADE_COLORS[level];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{t(`grade_${level}`)}</Text>
    </View>
  );
}

export function Badge({ label, color = C.muted, bg = '#EEEEEE' }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** "☆ Save" button with a folder picker. */
export function SaveButton({ item }: { item: Omit<Favorite, 'added' | 'folder'> }) {
  const { t, folders, isFavorite, addFavorite, removeFavorite } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const saved = isFavorite(item.key);
  const pick = (folder: string) => {
    addFavorite({ ...item, folder });
    setOpen(false);
    setName('');
  };
  return (
    <>
      <Button small kind="secondary" title={saved ? `★ ${t('saved')}` : `☆ ${t('addFavorite')}`} onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <T bold size={17}>{t('chooseFolder')}</T>
            <Row>
              {folders.map((f) => (
                <Chip key={f} label={f} onPress={() => pick(f)} />
              ))}
            </Row>
            <Input value={name} onChangeText={setName} placeholder={t('newFolder')} onSubmitEditing={() => name.trim() && pick(name.trim())} />
            <Row>
              <Button small title={t('create')} disabled={!name.trim()} onPress={() => pick(name.trim())} />
              {saved && (
                <Button
                  small
                  kind="danger"
                  title={t('remove')}
                  onPress={() => {
                    removeFavorite(item.key);
                    setOpen(false);
                  }}
                />
              )}
              <Button small kind="secondary" title={t('cancel')} onPress={() => setOpen(false)} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Shares (phone share sheet) or copies (browser) a text that always includes its source. */
export function ShareButton({ text }: { text: () => string }) {
  const { t } = useStore();
  const [copied, setCopied] = useState(false);
  const onPress = async () => {
    const message = text();
    try {
      if (Platform.OS !== 'web') {
        await Share.share({ message });
        return;
      }
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : null;
      if (nav?.share) {
        await nav.share({ text: message });
        return;
      }
    } catch {
      // Share sheet dismissed or unavailable: fall back to copying.
    }
    await Clipboard.setStringAsync(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return <Button small kind="secondary" title={copied ? `✓ ${t('copied')}` : `↗ ${t('share')}`} onPress={onPress} />;
}

export function LinkCard({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Pressable onPress={() => router.push(href as never)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  // No flex: 1 here: inside a ScrollView/FlatList it would cap the content at the screen height on Android,
  // so long tafsir or a full surah could not be scrolled.
  inner: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, paddingBottom: 32, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 8 },
  button: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },
});
