import { defineRouting } from 'next-intl/routing';
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import en from './messages/en.json';
import ko from './messages/ko.json';
import ja from './messages/ja.json';
import zh from './messages/zh.json';
import fr from './messages/fr.json';
import de from './messages/de.json';
import es from './messages/es.json';

export const routing = defineRouting({
  locales: ['en', 'ko', 'ja', 'zh', 'fr', 'de', 'es'],
  defaultLocale: 'en',
  localePrefix: 'never',
});

const messages: Record<string, any> = { en, ko, ja, zh, fr, de, es };

export default getRequestConfig(async ({ requestLocale }) => {
  // Try cookie first (set by language switcher), then request header, then default
  let locale: string | undefined;
  
  try {
    const cookieStore = await cookies();
    locale = cookieStore.get('NEXT_LOCALE')?.value;
  } catch {
    // cookies() may throw in some contexts
  }
  
  if (!locale) {
    locale = await requestLocale;
  }
  
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: messages[locale] || messages.en,
  };
});
