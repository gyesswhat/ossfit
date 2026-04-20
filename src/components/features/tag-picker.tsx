'use client';

import { Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  displayNameForSlug,
  isKnownLanguage,
  LANGUAGE_CATALOG,
  TOPIC_CATALOG,
} from '@/lib/github/catalog';

type Props = {
  selectedSlugs: readonly string[];
  personalTopicSlugs?: readonly string[];
  onChange: (next: string[]) => void;
  maxPerSection?: number;
};

type Group = {
  key: 'personal' | 'languages' | 'topics';
  titleKey: 'sectionPersonal' | 'sectionLanguages' | 'sectionTopics';
  descriptionKey:
    | 'sectionPersonalHint'
    | 'sectionLanguagesHint'
    | 'sectionTopicsHint';
  items: Array<{ slug: string; label: string; sublabel?: string | null }>;
};

const DEFAULT_MAX_PER_SECTION = 60;

/**
 * [목적] 스택 태그를 자유 입력이 아닌 카탈로그 기반 피커로 선택하게 한다.
 *        (1) 사용자 활동 토픽, (2) Linguist 언어, (3) Featured/Curated 토픽 세 그룹을 제공.
 * [주의] 필터 입력이 비어 있으면 각 섹션을 `maxPerSection` 개로 제한해 DOM을 가볍게 유지한다.
 *        필터가 있을 때는 매치되는 전부를 노출해 탐색을 지원한다.
 *        선택 상태는 부모가 관리하며, onChange는 새 배열 참조를 돌려준다.
 */
export function TagPicker({
  selectedSlugs,
  personalTopicSlugs = [],
  onChange,
  maxPerSection = DEFAULT_MAX_PER_SECTION,
}: Props) {
  const t = useTranslations('TagPicker');
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const hasFilter = normalized.length > 0;

  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);

  const groups = useMemo<Group[]>(() => {
    const personalItems = personalTopicSlugs
      .filter((slug) => !hasFilter || slug.includes(normalized))
      .map((slug) => ({
        slug,
        label: displayNameForSlug(slug),
        sublabel: isKnownLanguage(slug) ? t('langBadge') : t('topicBadge'),
      }));

    const languageItems = LANGUAGE_CATALOG.filter(
      (entry) =>
        !hasFilter ||
        entry.slug.includes(normalized) ||
        entry.name.toLowerCase().includes(normalized),
    )
      .slice(0, hasFilter ? Number.MAX_SAFE_INTEGER : maxPerSection)
      .map((entry) => ({ slug: entry.slug, label: entry.name }));

    const topicItems = TOPIC_CATALOG.filter(
      (entry) =>
        !hasFilter ||
        entry.name.includes(normalized) ||
        entry.displayName.toLowerCase().includes(normalized),
    )
      .slice(0, hasFilter ? Number.MAX_SAFE_INTEGER : maxPerSection)
      .map((entry) => ({
        slug: entry.name,
        label: entry.displayName,
        sublabel: entry.description,
      }));

    return [
      {
        key: 'personal',
        titleKey: 'sectionPersonal',
        descriptionKey: 'sectionPersonalHint',
        items: personalItems,
      },
      {
        key: 'languages',
        titleKey: 'sectionLanguages',
        descriptionKey: 'sectionLanguagesHint',
        items: languageItems,
      },
      {
        key: 'topics',
        titleKey: 'sectionTopics',
        descriptionKey: 'sectionTopicsHint',
        items: topicItems,
      },
    ];
  }, [hasFilter, maxPerSection, normalized, personalTopicSlugs, t]);

  function toggle(slug: string) {
    if (selectedSet.has(slug)) {
      onChange(selectedSlugs.filter((s) => s !== slug));
    } else {
      onChange([...selectedSlugs, slug]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex min-h-10 flex-wrap gap-2">
          {selectedSlugs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('selectedEmpty')}</p>
          ) : (
            selectedSlugs.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => toggle(slug)}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                aria-label={t('removeSelected', { tag: displayNameForSlug(slug) })}
              >
                {displayNameForSlug(slug)} ×
              </button>
            ))
          )}
        </div>
        <label className="relative flex items-center">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </label>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`picker-${group.key}`}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3
                id={`picker-${group.key}`}
                className="text-sm font-semibold text-foreground"
              >
                {t(group.titleKey)}
              </h3>
              <span className="text-xs text-muted-foreground">
                {t(group.descriptionKey)}
              </span>
            </div>
            {group.items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                {hasFilter ? t('noMatch') : t('empty')}
              </p>
            ) : (
              <ul className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                {group.items.map((item) => {
                  const selected = selectedSet.has(item.slug);
                  return (
                    <li key={item.slug}>
                      <button
                        type="button"
                        onClick={() => toggle(item.slug)}
                        aria-pressed={selected}
                        title={item.sublabel ?? undefined}
                        className={
                          selected
                            ? 'inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                            : 'inline-flex items-center gap-1 rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent'
                        }
                      >
                        {selected && <Check className="size-3" aria-hidden />}
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
