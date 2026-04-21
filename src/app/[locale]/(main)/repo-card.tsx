'use client';

import { Bookmark, CircleDot, Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { RepoResult } from '@/lib/github/search';

type Props = {
  repo: RepoResult;
  bookmarked: boolean;
  onOpen: (repo: RepoResult) => void;
};

/**
 * [목적] 피드의 단일 레포 카드. 클릭 시 상세 모달을 열어 이슈 목록을 노출한다.
 * [주의] 레포 description은 1줄, 토픽은 상위 4개만 노출해 카드 높이를 일정하게 유지한다.
 */
export function RepoCard({ repo, bookmarked, onOpen }: Props) {
  const t = useTranslations('Feed');
  const format = useFormatter();
  const pushed = new Date(repo.pushedAt);

  return (
    <li className="contents">
      <button
        type="button"
        onClick={() => onOpen(repo)}
        className="flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-shadow hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={t('openRepo', { repo: repo.nameWithOwner })}
      >
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground">
            {repo.nameWithOwner}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {bookmarked && (
              <Bookmark
                className="size-3.5 fill-primary text-primary"
                aria-label={t('bookmarked')}
              />
            )}
            <span className="flex items-center gap-1">
              <Star className="size-3" aria-hidden />
              {format.number(repo.stargazerCount)}
            </span>
          </span>
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
          {repo.description ?? t('descriptionEmpty')}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {repo.primaryLanguage && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {repo.primaryLanguage}
            </Badge>
          )}
          {repo.license && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {repo.license}
            </Badge>
          )}
          {repo.topics.slice(0, 3).map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {topic}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {t('pushedAt', { date: format.dateTime(pushed, 'short') })}
          </span>
          <span className="inline-flex items-center gap-1">
            <CircleDot className="size-3" aria-hidden />
            {t('openIssuesValue', { count: repo.openIssueCount })}
          </span>
        </div>
      </button>
    </li>
  );
}
