'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * exercise-library: main image or sheet image of an exercise from /api/exercise-media. Shows "Bild nicht verfügbar"
 * while the media are not uploaded yet (design D2).
 */
export function ExerciseImage({
  code,
  kind,
  alt,
  className,
}: {
  code: string;
  kind: 'main' | 'sheet';
  alt: string;
  className?: string;
}) {
  const t = useTranslations('exercise');
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // An error before hydration fires no onError; a loaded image without pixels counts as failed
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed)
    return (
      <span className={`exph ${className ?? ''}`} role="img" aria-label={`${alt}: ${t('imageMissing')}`}>
        {t('imageMissing')}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- private, signed-in only
    <img
      ref={ref}
      className={className}
      src={`/api/exercise-media/${encodeURIComponent(code)}/${kind}`}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
