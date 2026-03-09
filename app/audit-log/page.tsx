'use client';

import { useTranslations } from 'next-intl';
import ComingSoon from '@/components/ComingSoon';

export default function AuditLogPage() {
  const t = useTranslations('pages');
  return (
    <ComingSoon
      icon="📜"
      title={t('auditLog.title')}
      description={t('auditLog.desc')}
    />
  );
}
