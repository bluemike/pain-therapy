'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * zone-record: Navigation der Patienten-Zone (iteration 6, design D6). "Übungen" only with an active home program;
 * the layout leaves the tabs out while a signature is pending.
 */
export function ZoneTabs({ exercises }: { exercises: boolean }) {
  const t = useTranslations('nav');
  const path = usePathname();
  const tabs = [
    ...(exercises ? [['/', t('exercises')] as const] : []),
    ['/behandlungen', t('treatments')] as const,
    ['/dokumente', t('documents')] as const,
  ];
  const current = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
  return (
    <nav className="ztabs" aria-label={t('label')}>
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} aria-current={current(href) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
