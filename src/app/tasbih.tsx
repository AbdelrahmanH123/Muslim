import { Platform, Pressable, Vibration, View } from 'react-native';
import { Arabic, Button, C, Card, Chip, Row, Screen, T } from '../components/ui';
import { usePersisted } from '../lib/persist';
import { useStore } from '../lib/store';

const PHRASES = [
  { ar: 'سُبْحَانَ اللَّهِ', en: 'SubhanAllah' },
  { ar: 'الْحَمْدُ لِلَّهِ', en: 'Alhamdulillah' },
  { ar: 'اللَّهُ أَكْبَرُ', en: 'Allahu Akbar' },
  { ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ', en: 'La ilaha illallah' },
  { ar: 'أَسْتَغْفِرُ اللَّهَ', en: 'Astaghfirullah' },
  { ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', en: 'Salawat on the Prophet ﷺ' },
  { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', en: 'SubhanAllahi wa bihamdihi' },
  { ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', en: 'La hawla wa la quwwata illa billah' },
];
const TARGETS = [33, 99, 100, 0]; // 0 = no target

type State = { phrase: number; count: number; target: number; total: number };

export default function TasbihScreen() {
  const { t } = useStore();
  const [s, setS] = usePersisted<State>('tasbih', { phrase: 0, count: 0, target: 33, total: 0 });
  const phrase = PHRASES[s.phrase] ?? PHRASES[0];
  const reached = s.target > 0 && s.count >= s.target;

  const tap = () => {
    const count = s.count + 1;
    if (s.target > 0 && count === s.target) buzz(300);
    else buzz(15);
    setS({ ...s, count, total: s.total + 1 });
  };

  return (
    <Screen>
      <Row>
        {PHRASES.map((p, i) => (
          <Chip key={p.en} label={p.en} active={s.phrase === i} onPress={() => setS({ ...s, phrase: i, count: 0 })} />
        ))}
      </Row>
      <Card style={{ alignItems: 'center' }}>
        <Arabic size={30} style={{ textAlign: 'center' }}>{phrase.ar}</Arabic>
        <Pressable
          onPress={tap}
          accessibilityRole="button"
          accessibilityLabel={t('tapToCount')}
          style={({ pressed }) => ({
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: reached ? C.gold : C.primary,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.96 : 1 }],
            marginVertical: 12,
          })}
        >
          <T bold size={56} style={{ color: '#fff', textAlign: 'center' }}>{s.count}</T>
          <T style={{ color: '#E3F0EA', textAlign: 'center' }}>{s.target ? `/ ${s.target}` : t('tapToCount')}</T>
        </Pressable>
        {reached ? <T bold style={{ color: C.gold }}>{t('targetReached')}</T> : <T muted>{t('tapToCount')}</T>}
        <T muted size={12}>
          {t('totalCount')}: {s.total}
        </T>
      </Card>
      <Card>
        <T bold>{t('target')}</T>
        <Row>
          {TARGETS.map((n) => (
            <Chip key={n} label={n ? String(n) : '∞'} active={s.target === n} onPress={() => setS({ ...s, target: n })} />
          ))}
        </Row>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button kind="secondary" title={t('reset')} onPress={() => setS({ ...s, count: 0 })} />
        </View>
      </Card>
    </Screen>
  );
}

function buzz(ms: number) {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } else {
    Vibration.vibrate(ms);
  }
}
