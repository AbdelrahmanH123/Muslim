import { LinkCard, Row, Screen, T } from '../../components/ui';
import { useStore } from '../../lib/store';
import { TOPICS } from '../../lib/topics';

export default function TopicsScreen() {
  const { t, lang } = useStore();
  return (
    <Screen>
      <T muted>{t('topicsIntro')}</T>
      {TOPICS.map((topic) => (
        <LinkCard key={topic.id} href={`/topic/${topic.id}`}>
          <Row style={{ flexWrap: 'nowrap' }}>
            <T size={26}>{topic.icon}</T>
            <T bold size={16} style={{ flexShrink: 1 }}>
              {lang === 'ar' ? topic.ar : topic.en}
            </T>
          </Row>
        </LinkCard>
      ))}
    </Screen>
  );
}
