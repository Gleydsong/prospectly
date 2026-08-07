import Image from 'next/image';
import { t, type Locale } from '@/lib/i18n';

type BrandLogoProps = {
  locale: Locale;
  priority?: boolean;
};

export function BrandLogo({ locale, priority = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/brand/prospectly-mark-v2.svg"
        width={32}
        height={32}
        alt=""
        aria-hidden
        className="h-8 w-8 shrink-0"
        priority={priority}
      />
      <span className="text-lg font-semibold tracking-tight text-[color:var(--ink)]">
        {t(locale, 'brand')}
      </span>
    </span>
  );
}
