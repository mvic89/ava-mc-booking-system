import {getRequestConfig} from 'next-intl/server';
import {cookies} from 'next/headers';

// Can be imported from a shared config
export const locales = ['en', 'sv', 'no', 'da', 'ar'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  // Get locale from cookie or default to 'en'
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'en';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
