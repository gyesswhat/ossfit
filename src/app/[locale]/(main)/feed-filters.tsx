'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { displayNameForSlug } from '@/lib/github/catalog';
import { RECOMMENDED_LABELS } from '@/lib/github/search';

type Props = {
  availableLanguages: readonly string[];
  availableTopics: readonly string[];
  defaultLabels: readonly string[];
};

type ToggleKey = 'label' | 'language' | 'topic';

/**
 * [목적] 라벨/언어/토픽 토글 필터. 한 줄 헤더로 역할을 명시하고, 그룹별로 섹션을 분리해
 *        어디서 조정하는지 곧바로 인지하게 한다.
 * [주의] 변경은 URL searchParams로 영속화하고 RSC를 재검증한다.
 *        한 그룹이 0개면 `-Empty` 힌트를 노출해 "클릭해서 선택" 액션을 유도한다.
 */
export function FeedFilters({
  availableLanguages,
  availableTopics,
  defaultLabels,
}: Props) {
  const t = useTranslations('Feed');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedLabelsRaw = searchParams.getAll('label');
  const selectedLabels =
    selectedLabelsRaw.length > 0 ? selectedLabelsRaw : defaultLabels;
  const selectedLanguages = searchParams.getAll('language');
  const selectedTopics = searchParams.getAll('topic');

  function toggle(key: ToggleKey, value: string, on: boolean) {
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

  function clearGroup(key: ToggleKey) {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm"
      aria-busy={isPending}
    >
      <header className="flex items-center gap-2 border-b border-border pb-3">
        <SlidersHorizontal className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">
          {t('filtersHeading')}
        </h2>
        <span className="text-xs text-muted-foreground">{t('filtersHint')}</span>
      </header>

      <FilterGroup
        title={t('filterLabels')}
        emptyHint={t('filterLabelsEmpty')}
        isEmpty={selectedLabels.length === 0}
      >
        {RECOMMENDED_LABELS.map((label) => {
          const active = selectedLabels.includes(label);
          return (
            <Chip
              key={label}
              label={label}
              active={active}
              onClick={() => toggle('label', label, !active)}
            />
          );
        })}
      </FilterGroup>

      {availableLanguages.length > 0 && (
        <FilterGroup
          title={t('filterLanguages')}
          emptyHint={null}
          isEmpty={false}
          onClear={
            selectedLanguages.length > 0 ? () => clearGroup('language') : null
          }
          clearLabel={t('clearLanguages')}
        >
          {availableLanguages.map((language) => {
            const active = selectedLanguages.includes(language);
            return (
              <Chip
                key={language}
                label={displayNameForSlug(language)}
                active={active}
                onClick={() => toggle('language', language, !active)}
              />
            );
          })}
        </FilterGroup>
      )}

      {availableTopics.length > 0 && (
        <FilterGroup
          title={t('filterTopics')}
          emptyHint={null}
          isEmpty={false}
          onClear={
            selectedTopics.length > 0 ? () => clearGroup('topic') : null
          }
          clearLabel={t('clearTopics')}
        >
          {availableTopics.map((topic) => {
            const active = selectedTopics.includes(topic);
            return (
              <Chip
                key={topic}
                label={displayNameForSlug(topic)}
                active={active}
                onClick={() => toggle('topic', topic, !active)}
              />
            );
          })}
        </FilterGroup>
      )}
    </section>
  );
}

function FilterGroup({
  title,
  emptyHint,
  isEmpty,
  onClear,
  clearLabel,
  children,
}: {
  title: string;
  emptyHint: string | null;
  isEmpty: boolean;
  onClear?: (() => void) | null;
  clearLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {onClear && clearLabel && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {clearLabel}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {isEmpty && emptyHint && (
          <span className="text-xs text-destructive">{emptyHint}</span>
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
}
