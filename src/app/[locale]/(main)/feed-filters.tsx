'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { displayNameForSlug } from '@/lib/github/catalog';
import {
  DEFAULT_SORT,
  MIN_STARS_OPTIONS,
  SORT_OPTIONS,
  type MinStarsOption,
  type SortOption,
} from '@/lib/github/search';

type Props = {
  availableLanguages: readonly string[];
  availableTopics: readonly string[];
};

type ToggleKey = 'language' | 'topic';

/**
 * [목적] 언어/토픽 토글 + 정렬 + 최소 별 수 필터 패널. URL searchParams에 모든 상태를 영속화한다.
 * [주의] 변경 시 `startTransition`으로 감싸 RSC 재요청을 논블로킹 처리한다.
 */
export function FeedFilters({
  availableLanguages,
  availableTopics,
}: Props) {
  const t = useTranslations('Feed');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedLanguages = searchParams.getAll('language');
  const selectedTopics = searchParams.getAll('topic');

  const sortParam = searchParams.get('sort');
  const selectedSort: SortOption =
    sortParam && (SORT_OPTIONS as readonly string[]).includes(sortParam)
      ? (sortParam as SortOption)
      : DEFAULT_SORT;

  const minStarsParam = Number(searchParams.get('minStars') ?? 0);
  const selectedMinStars: MinStarsOption | 0 = (MIN_STARS_OPTIONS as readonly number[]).includes(
    minStarsParam,
  )
    ? (minStarsParam as MinStarsOption)
    : 0;

  function updateParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    next.delete('page');
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  }

  function toggle(key: ToggleKey, value: string, on: boolean) {
    updateParams((next) => {
      const current = next.getAll(key);
      next.delete(key);
      const wanted = on
        ? Array.from(new Set([...current, value]))
        : current.filter((v) => v !== value);
      for (const v of wanted) next.append(key, v);
    });
  }

  function clearGroup(key: ToggleKey) {
    updateParams((next) => {
      next.delete(key);
    });
  }

  function setSort(value: SortOption) {
    updateParams((next) => {
      next.delete('sort');
      if (value !== DEFAULT_SORT) next.set('sort', value);
    });
  }

  function setMinStars(value: MinStarsOption | 0) {
    updateParams((next) => {
      next.delete('minStars');
      if (value > 0) next.set('minStars', String(value));
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

      {availableLanguages.length > 0 && (
        <FilterGroup
          title={t('filterLanguages')}
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

      <FilterGroup title={t('filterSort')}>
        {SORT_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={t(`sortOption.${option}`)}
            active={selectedSort === option}
            onClick={() => setSort(option)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title={t('filterMinStars')}>
        <Chip
          label={t('minStarsAny')}
          active={selectedMinStars === 0}
          onClick={() => setMinStars(0)}
        />
        {MIN_STARS_OPTIONS.map((value) => (
          <Chip
            key={value}
            label={`≥ ${value}`}
            active={selectedMinStars === value}
            onClick={() => setMinStars(value)}
          />
        ))}
      </FilterGroup>
    </section>
  );
}

function FilterGroup({
  title,
  onClear,
  clearLabel,
  children,
}: {
  title: string;
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
      <div className="flex flex-wrap items-center gap-2">{children}</div>
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
