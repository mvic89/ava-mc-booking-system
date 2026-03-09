'use client';

import { useTranslations } from 'next-intl';
import ComingSoon from '@/components/ComingSoon';

export default function DocumentsPage() {
  const t = useTranslations('pages');
  return (
    <ComingSoon
      icon="📄"
      title={t('documents.title')}
      description={t('documents.desc')}
    />
  );
}
