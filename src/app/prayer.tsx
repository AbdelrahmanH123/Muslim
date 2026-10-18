import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, C, Card, Chip, ErrorBox, Input, Row, Screen, T } from '../components/ui';
import { formatTime, METHODS, PRAYERS, prayerTimes, qibla, type MethodId } from '../lib/prayer';
import { useStore } from '../lib/store';

export default function PrayerScreen() {
  const { t, lang, prayer, setPrayer } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [manual, setManual] = useState({ lat: '', lng: '' });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const locate = async () => {
    setBusy(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error(t('locationDenied'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPrayer({ ...prayer, lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const saveManual = () => {
    const lat = Number(manual.lat);
    const lng = Number(manual.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setError(new Error(t('badCoordinates')));
      return;
    }
    setError(null);
    setPrayer({ ...prayer, lat, lng });
  };

  const pt = prayerTimes(prayer, now);
  const direction = prayer.lat != null && prayer.lng != null ? qibla(prayer.lat, prayer.lng) : null;

  return (
    <Screen>
      {pt ? (
        <Card>
          <T bold size={17}>{t('prayerTimes')} · {now.toLocaleDateString()}</T>
          {PRAYERS.map((p) => (
            <Row key={p} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <T bold={pt.next === p} style={pt.next === p ? { color: C.primary } : undefined}>
                {pt.next === p ? '▶ ' : ''}
                {t(`prayer_${p}`)}
              </T>
              <T bold={pt.next === p} style={pt.next === p ? { color: C.primary } : undefined}>{formatTime(pt.times[p], lang)}</T>
            </Row>
          ))}
          <T muted size={12}>
            {METHODS[prayer.method]} · {prayer.hanafiAsr ? t('asrHanafi') : t('asrStandard')} · {prayer.lat}, {prayer.lng}
          </T>
        </Card>
      ) : (
        <Card>
          <T>{t('setUpPrayer')}</T>
        </Card>
      )}

      {direction != null && (
        <Card style={{ alignItems: 'center' }}>
          <T bold size={17}>🧭 {t('qibla')}</T>
          <Compass bearing={direction} />
          <T bold size={20}>{Math.round(direction)}°</T>
          <T muted size={13} style={{ textAlign: 'center' }}>{t('qiblaHelp')}</T>
        </Card>
      )}

      <Card>
        <T bold>{t('location')}</T>
        <Row>
          <Button title={busy ? t('loading') : `📍 ${t('useMyLocation')}`} onPress={locate} disabled={busy} />
        </Row>
        <T muted size={13}>{t('orEnterCoordinates')}</T>
        <Row style={{ flexWrap: 'nowrap' }}>
          <View style={{ flex: 1 }}>
            <Input value={manual.lat} onChangeText={(lat) => setManual({ ...manual, lat })} placeholder={t('latitude')} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Input value={manual.lng} onChangeText={(lng) => setManual({ ...manual, lng })} placeholder={t('longitude')} keyboardType="numbers-and-punctuation" />
          </View>
          <Button small kind="secondary" title={t('save')} onPress={saveManual} />
        </Row>
        {error ? <ErrorBox error={error} /> : null}
      </Card>

      <Card>
        <T bold>{t('calculationMethod')}</T>
        <Row>
          {(Object.keys(METHODS) as MethodId[]).map((m) => (
            <Chip key={m} label={METHODS[m]} active={prayer.method === m} onPress={() => setPrayer({ ...prayer, method: m })} />
          ))}
        </Row>
        <T bold>{t('asrMethod')}</T>
        <Row>
          <Chip label={t('asrStandard')} active={!prayer.hanafiAsr} onPress={() => setPrayer({ ...prayer, hanafiAsr: false })} />
          <Chip label={t('asrHanafi')} active={prayer.hanafiAsr} onPress={() => setPrayer({ ...prayer, hanafiAsr: true })} />
        </Row>
        <T muted size={12}>{t('prayerDisclaimer')}</T>
      </Card>
    </Screen>
  );
}

const round = (x: number) => Math.round(x * 10000) / 10000;

/** A compass card with north at the top and an arrow pointing to the Qibla. */
function Compass({ bearing }: { bearing: number }) {
  const size = 180;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <T bold style={{ position: 'absolute', top: 6, color: C.danger }}>N</T>
      <T muted style={{ position: 'absolute', bottom: 6 }}>S</T>
      <T muted style={{ position: 'absolute', left: 10 }}>W</T>
      <T muted style={{ position: 'absolute', right: 10 }}>E</T>
      {/* A full-size layer rotated around the centre; the arrow is drawn in its upper half. */}
      <View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', transform: [{ rotate: `${bearing}deg` }] }}>
        <View style={{ width: 0, height: 0, marginTop: 20, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C.primary }} />
        <View style={{ width: 6, height: size / 2 - 52, backgroundColor: C.primary, borderRadius: 3 }} />
      </View>
      <T size={22}>🕋</T>
    </View>
  );
}
