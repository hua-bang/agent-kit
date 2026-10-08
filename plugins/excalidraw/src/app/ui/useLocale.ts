import { useState } from 'react';
import { messagesFor, storedLocale, storeLocale, type Locale } from './i18n';

/** A language the user picked wins over the host's; the choice is remembered per browser profile. */
export function useLocale(hostLocale: Locale) {
  const [chosen, setChosen] = useState<Locale | null>(storedLocale);
  const locale = chosen ?? hostLocale;
  return {
    locale,
    t: messagesFor(locale),
    toggle() { const next = locale === 'en' ? 'zh-CN' : 'en'; storeLocale(next); setChosen(next); },
  };
}
