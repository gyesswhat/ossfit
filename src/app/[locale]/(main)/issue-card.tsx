'use client';

import { Bookmark, Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { IssueResult } from '@/lib/github/search';

type Props = {
  issue: IssueResult;
  bookmarked: boolean;
  onOpen: (issue: IssueResult) => void;
};

/**
 * [목적] 피드의 단일 이슈 카드. 클릭 시 상세 모달을 연다.
 * [주의] 제목 링크는 카드 내부 이벤트 버블링을 막아 외부 GitHub 이동과 모달 오픈을 분리한다.
 *        라벨 색상은 GitHub이 보장하는 hex이지만 무효 값에는 회색 폴백 + 휘도 기반 글자색을 적용한다.
 */
export function IssueCard({ issue, bookmarked, onOpen }: Props) {
  const t = useTranslations('Feed');
  const format = useFormatter();
  const created = new Date(issue.createdAt);

  return (
    <li className="contents">
      <button
        type="button"
        onClick={() => onOpen(issue)}
        className="flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-shadow hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={t('openIssue', {
          repo: issue.repository.nameWithOwner,
          number: issue.number,
        })}
      >
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate font-medium">
            {issue.repository.nameWithOwner}
          </span>
          <span className="flex items-center gap-2">
            {bookmarked && (
              <Bookmark
                className="size-3.5 fill-primary text-primary"
                aria-label={t('bookmarked')}
              />
            )}
            <span className="flex items-center gap-1">
              <Star className="size-3" aria-hidden />
              {format.number(issue.repository.stargazerCount)}
            </span>
          </span>
        </div>
        <span className="line-clamp-2 text-base font-semibold text-foreground">
          {issue.title}
        </span>
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {issue.repository.primaryLanguage && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {issue.repository.primaryLanguage}
            </Badge>
          )}
          {issue.labels.slice(0, 4).map((label) => (
            <span
              key={label.name}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={labelStyle(label.color)}
            >
              {label.name}
            </span>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {t('createdAt', { date: format.dateTime(created, 'short') })}
        </span>
      </button>
    </li>
  );
}

function labelStyle(color: string): React.CSSProperties {
  const safe = /^[0-9a-fA-F]{6}$/.test(color) ? color : 'e5e7eb';
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    backgroundColor: `#${safe}`,
    color: luminance > 0.6 ? '#171717' : '#ffffff',
  };
}
