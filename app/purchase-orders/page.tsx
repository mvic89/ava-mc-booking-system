'use client';

import { useTranslations } from 'next-intl';
import ComingSoon from '@/components/ComingSoon';

export default function PurchaseOrdersPage() {
  const t = useTranslations('pages');
  return (
    <ComingSoon
      icon="📦"
      title={t('purchaseOrders.title')}
      description={t('purchaseOrders.desc')}
    />
  );
}
