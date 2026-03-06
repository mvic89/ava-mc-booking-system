'use client';

import { useTranslations } from 'next-intl';
import ComingSoon from '@/components/ComingSoon';

export default function AnalyticsPage() {
  const t = useTranslations('pages');
  return (
    <ComingSoon
      icon="📈"
      title={t('analytics.title')}
      description={t('analytics.desc')}
    />
  );
}
