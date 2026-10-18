import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Arabic, Button, C, Card, Chip, English, Row, Screen, T } from '../../components/ui';
import { keyHref } from '../../lib/format';
import { useStore } from '../../lib/store';

export default function FavoritesScreen() {
  const { t, favorites, folders, removeFavorite, removeFolder } = useStore();
  const [folder, setFolder] = useState<string | null>(null);
  const list = folder ? favorites.filter((f) => f.folder === folder) : favorites;

  return (
    <Screen>
      <Row>
        <Chip label={`${t('filterAll')} (${favorites.length})`} active={folder === null} onPress={() => setFolder(null)} />
        {folders.map((f) => (
          <Chip key={f} label={`${f} (${favorites.filter((x) => x.folder === f).length})`} active={folder === f} onPress={() => setFolder(f)} />
        ))}
      </Row>
      {folder && (
        <Row>
          <Button
            small
            kind="danger"
            title={t('deleteFolder')}
            onPress={() => {
              removeFolder(folder);
              setFolder(null);
            }}
          />
        </Row>
      )}
      {list.length === 0 && <T muted>{t('favoritesEmpty')}</T>}
      {list.map((f) => (
        <Card key={f.key + f.folder}>
          <Pressable style={{ gap: 8 }} onPress={() => router.push(keyHref(f.key) as never)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T bold style={{ color: C.primary, flexShrink: 1 }}>{f.title}</T>
            <T muted size={12}>📁 {f.folder}</T>
          </Row>
          {f.ar ? <Arabic size={20}>{f.ar.length > 400 ? f.ar.slice(0, 400) + '…' : f.ar}</Arabic> : null}
          {f.en ? <English style={{ color: C.muted }}>{f.en.length > 300 ? f.en.slice(0, 300) + '…' : f.en}</English> : null}
          </Pressable>
          <Row>
            <Button small kind="danger" title={t('remove')} onPress={() => removeFavorite(f.key, f.folder)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
