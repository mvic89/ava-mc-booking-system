'use client';

import { useTranslations } from 'next-intl';
import ComingSoon from '@/components/ComingSoon';

export default function InvoicesPage() {
  const t = useTranslations('pages');
  return (
    <ComingSoon
      icon="📧"
      title={t('invoices.title')}
      description={t('invoices.desc')}
    />
  );
}
