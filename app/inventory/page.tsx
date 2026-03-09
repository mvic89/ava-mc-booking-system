'use client';

import { useTranslations } from 'next-intl';
import ComingSoon from '@/components/ComingSoon';

export default function InventoryPage() {
  const t = useTranslations('pages');
  return (
    <ComingSoon
      icon="🏍"
      title={t('inventory.title')}
      description={t('inventory.desc')}
    />
  );
}
