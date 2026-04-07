import {getRequestConfig} from 'next-intl/server';
import {cookies} from 'next/headers';

// Can be imported from a shared config
export const locales = ['en', 'sv', 'no', 'da', 'ar', 'fr', 'es', 'de', 'nl'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  // Get locale from cookie or default to 'sv'
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'sv';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
