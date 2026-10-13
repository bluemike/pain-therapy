import { getLocale } from 'next-intl/server';
import { setLocale } from '@/app/(app)/actions';

export async function LanguageSwitch() {
  const locale = await getLocale();
  return (
    <form action={setLocale} className="lang" role="group" aria-label="Language / Sprache">
      {(['de', 'en'] as const).map((l) => (
        <button key={l} name="locale" value={l} aria-pressed={locale === l} lang={l}>
          {l.toUpperCase()}
        </button>
      ))}
    </form>
  );
}
