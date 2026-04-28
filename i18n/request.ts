import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'sv';
  const validLocales = ['en', 'sv', 'no', 'da', 'ar', 'fr', 'es', 'de', 'nl'];
  const resolvedLocale = validLocales.includes(locale) ? locale : 'sv';

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  };
});
