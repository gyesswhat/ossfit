'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { RECOMMENDED_LABELS } from '@/lib/github/search';

type Props = {
  availableLanguages: readonly string[];
  defaultLabels: readonly string[];
};

/**
 * [목적] 라벨/언어 토글 필터. 변경 시 URL searchParams로 상태를 영속화하고 페이지를 재검증한다.
 * [주의] next-intl의 router/pathname을 사용해 locale 프리픽스가 자동 유지되도록 한다.
 *        선택값이 비어 있으면 기본값(`good first issue`, 프로필 스택 전체)이 서버에서 적용된다.
 */
export function FeedFilters({ availableLanguages, defaultLabels }: Props) {
  const t = useTranslations('Feed');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedLabelsRaw = searchParams.getAll('label');
  const selectedLabels =
    selectedLabelsRaw.length > 0 ? selectedLabelsRaw : defaultLabels;
  const selectedLanguages = searchParams.getAll('language');

  function update(key: 'label' | 'language', value: string, on: boolean) {
    const next = new URLSearchParams(searchParams);
    const current = next.getAll(key);
    next.delete(key);
    const wanted = on
      ? Array.from(new Set([...current, value]))
      : current.filter((v) => v !== value);
    for (const v of wanted) next.append(key, v);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('filterLabels')}
        </span>
        {RECOMMENDED_LABELS.map((label) => {
          const active = selectedLabels.includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => update('label', label, !active)}
              aria-pressed={active}
              className={
                active
                  ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                  : 'rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent'
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      {availableLanguages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('filterLanguages')}
          </span>
          {availableLanguages.map((language) => {
            const active = selectedLanguages.includes(language);
            return (
              <button
                key={language}
                type="button"
                onClick={() => update('language', language, !active)}
                aria-pressed={active}
                className={
                  active
                    ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                    : 'rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent'
                }
              >
                {language}
              </button>
            );
          })}
          {selectedLanguages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('language');
                startTransition(() => {
                  router.replace(`${pathname}?${next.toString()}`);
                });
              }}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t('clearLanguages')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
