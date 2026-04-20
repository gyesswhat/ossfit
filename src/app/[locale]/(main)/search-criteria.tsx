'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { displayNameForSlug } from '@/lib/github/catalog';
import type { SortOption } from '@/lib/github/search';

type ChipSource = 'default' | 'custom';

type Props = {
  languages: readonly string[];
  topics: readonly string[];
  labels: readonly string[];
  languageSource: ChipSource;
  topicSource: ChipSource;
  labelSource: ChipSource;
  sort: SortOption;
  minStars: number;
  noAssignee: boolean;
  rawQuery: string;
  hasStack: boolean;
};

/**
 * [목적] 현재 활성화된 검색 기준(언어·토픽·라벨·정렬·필터)을 사람이 읽기 쉬운 배지와
 *        GitHub raw query 양쪽으로 안내한다. 각 값의 출처(프로필 기본값 vs URL override)도 표시한다.
 * [주의] 스택이 비어 있을 때도 패널 자체는 렌더해 '스택 설정' CTA를 노출한다.
 */
export function SearchCriteria({
  languages,
  topics,
  labels,
  languageSource,
  topicSource,
  labelSource,
  sort,
  minStars,
  noAssignee,
  rawQuery,
  hasStack,
}: Props) {
  const t = useTranslations('Feed');
  const [showRaw, setShowRaw] = useState(false);

  return (
    <section
      aria-labelledby="criteria-heading"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <header className="flex items-center gap-2 border-b border-border pb-3">
        <Info className="size-4 text-primary" aria-hidden />
        <h2
          id="criteria-heading"
          className="text-sm font-semibold text-foreground"
        >
          {t('criteriaHeading')}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t('criteriaHint')}
        </span>
      </header>

      {!hasStack ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border px-3 py-2">
          <p className="text-sm text-muted-foreground">{t('criteriaNoStack')}</p>
          <Link
            href="/profile"
            className="inline-flex h-7 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
          >
            {t('criteriaSetupStack')}
          </Link>
        </div>
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          <CriteriaRow
            label={t('filterLanguages')}
            source={languageSource}
            sourceLabel={sourceLabel(t, languageSource)}
            values={languages.map((slug) => displayNameForSlug(slug))}
            emptyLabel={t('criteriaEmpty')}
          />
          <CriteriaRow
            label={t('filterTopics')}
            source={topicSource}
            sourceLabel={sourceLabel(t, topicSource)}
            values={topics.map((slug) => displayNameForSlug(slug))}
            emptyLabel={t('criteriaEmpty')}
          />
          <CriteriaRow
            label={t('filterLabels')}
            source={labelSource}
            sourceLabel={sourceLabel(t, labelSource)}
            values={labels}
            emptyLabel={t('criteriaEmpty')}
          />
          <SimpleRow label={t('filterSort')} value={t(`sortOption.${sort}`)} />
          <SimpleRow
            label={t('filterMinStars')}
            value={minStars > 0 ? `≥ ${minStars}` : t('minStarsAny')}
          />
          <SimpleRow
            label={t('filterAssignee')}
            value={noAssignee ? t('assigneeUnassigned') : t('assigneeAny')}
          />
        </dl>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          aria-expanded={showRaw}
        >
          {showRaw ? (
            <ChevronUp className="size-3" aria-hidden />
          ) : (
            <ChevronDown className="size-3" aria-hidden />
          )}
          {showRaw ? t('criteriaHideRaw') : t('criteriaShowRaw')}
        </button>
        {showRaw && (
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
            <code>{rawQuery || t('criteriaRawEmpty')}</code>
          </pre>
        )}
      </div>
    </section>
  );
}

function sourceLabel(
  t: (key: string) => string,
  source: ChipSource,
): string {
  return source === 'default' ? t('sourceDefault') : t('sourceCustom');
}

function CriteriaRow({
  label,
  source,
  sourceLabel,
  values,
  emptyLabel,
}: {
  label: string;
  source: ChipSource;
  sourceLabel: string;
  values: readonly string[];
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        <Badge
          variant={source === 'default' ? 'outline' : 'accent'}
          className="h-4 px-1.5 text-[10px] font-normal"
        >
          {sourceLabel}
        </Badge>
      </dt>
      <dd className="flex flex-wrap gap-1.5">
        {values.length > 0 ? (
          values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              {value}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">{emptyLabel}</span>
        )}
      </dd>
    </div>
  );
}

function SimpleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-xs text-foreground">{value}</dd>
    </div>
  );
}
