'use client';

import { useTranslations } from 'next-intl';
import ComingSoon from '@/components/ComingSoon';

export default function UsersPage() {
  const t = useTranslations('pages');
  return (
    <ComingSoon
      icon="👤"
      title={t('users.title')}
      description={t('users.desc')}
    />
  );
}
