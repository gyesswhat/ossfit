'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Bookmark,
  ExternalLink,
  MessageCircle,
  Star,
  Users,
  X,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RepoDetail, RepoIssueSummary } from '@/lib/github/repo';
import type { RepoResult } from '@/lib/github/search';
import { toggleBookmarkAction } from './bookmark-actions';

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; detail: RepoDetail }
  | { status: 'error'; messageKey: 'rate-limit' | 'missing-token' | 'unknown' };

type Props = {
  locale: string;
  repo: RepoResult | null;
  initialBookmarked: boolean;
  onClose: () => void;
  onBookmarkChange: (repoUrl: string, bookmarked: boolean) => void;
};

/**
 * [목적] 레포 카드 클릭 시 열리는 상세 모달. description/토픽/라이선스/기여 후보 이슈 목록을 보여준다.
 * [주의] 이슈 목록은 good-first-issue + help-wanted 상위 5개씩 병렬 조회한다.
 *        ESC·배경 클릭으로 닫되, 배경 스크롤은 잠가 시선 분산을 막는다.
 */
export function RepoDetailModal({
  locale,
  repo,
  initialBookmarked,
  onClose,
  onBookmarkChange,
}: Props) {
  const t = useTranslations('Feed');
  const format = useFormatter();
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [trackedRepoUrl, setTrackedRepoUrl] = useState<string | null>(null);

  const currentRepoUrl = repo?.url ?? null;
  if (trackedRepoUrl !== currentRepoUrl) {
    setTrackedRepoUrl(currentRepoUrl);
    setState(repo ? { status: 'loading' } : { status: 'idle' });
    setToggleError(null);
  }

  const bookmarked = initialBookmarked;

  useEffect(() => {
    if (!repo) return;
    const controller = new AbortController();

    const url = `/api/github/repo?repo=${encodeURIComponent(repo.nameWithOwner)}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 429) {
          setState({ status: 'error', messageKey: 'rate-limit' });
          return;
        }
        if (res.status === 401) {
          setState({ status: 'error', messageKey: 'missing-token' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', messageKey: 'unknown' });
          return;
        }
        const detail = (await res.json()) as RepoDetail;
        setState({ status: 'ready', detail });
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setState({ status: 'error', messageKey: 'unknown' });
      });

    return () => controller.abort();
  }, [repo]);

  useEffect(() => {
    if (!repo) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);

    return () => {
      body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [repo, onClose]);

  if (!repo) return null;

  function handleBookmark() {
    if (!repo) return;
    setToggleError(null);
    startTransition(async () => {
      const result = await toggleBookmarkAction({
        locale,
        repoUrl: repo.url,
        repoFullName: repo.nameWithOwner,
      });
      if (result.status === 'ok') {
        onBookmarkChange(repo.url, result.bookmarked);
        return;
      }
      if (result.status === 'unauthenticated') {
        setToggleError(t('bookmarkUnauthenticated'));
        return;
      }
      setToggleError(t('bookmarkError'));
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repo-detail-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-card shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('close')}
        >
          <X className="size-4" aria-hidden />
        </button>

        <header className="flex flex-col gap-3 border-b border-border p-6 pr-14">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {repo.nameWithOwner}
          </p>
          <h2
            id="repo-detail-title"
            className="text-xl font-semibold text-foreground"
          >
            {repo.description ?? repo.name}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" aria-hidden />
              {format.number(repo.stargazerCount)}
            </span>
            {state.status === 'ready' && (
              <>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden />
                  {format.number(state.detail.watcherCount)}
                </span>
                <span>
                  {t('openIssuesValue', { count: state.detail.openIssueCount })}
                </span>
              </>
            )}
            <span>
              {t('pushedAt', {
                date: format.dateTime(new Date(repo.pushedAt), 'short'),
              })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
            {repo.topics.slice(0, 6).map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {topic}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant={bookmarked ? 'default' : 'outline'}
              size="sm"
              onClick={handleBookmark}
              disabled={isPending}
            >
              <Bookmark
                className={bookmarked ? 'fill-primary-foreground' : ''}
                aria-hidden
              />
              {bookmarked ? t('bookmarkRemove') : t('bookmarkAdd')}
            </Button>
            <Button asChild type="button" variant="outline" size="sm">
              <a href={repo.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                {t('viewOnGithub')}
              </a>
            </Button>
          </div>
          {toggleError && (
            <p role="alert" className="text-xs text-destructive">
              {toggleError}
            </p>
          )}
        </header>

        <div className="flex flex-col gap-4 p-6">
          {state.status === 'loading' && (
            <p className="text-sm text-muted-foreground">{t('detailLoading')}</p>
          )}
          {state.status === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {state.messageKey === 'rate-limit'
                ? t('errorRateLimit')
                : state.messageKey === 'missing-token'
                  ? t('errorMissingToken')
                  : t('errorUnknown')}
            </p>
          )}
          {state.status === 'ready' && (
            <>
              <IssueSection
                title={t('issuesGoodFirst')}
                emptyLabel={t('issuesEmpty')}
                issues={state.detail.goodFirstIssues}
              />
              <IssueSection
                title={t('issuesHelpWanted')}
                emptyLabel={t('issuesEmpty')}
                issues={state.detail.helpWantedIssues}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueSection({
  title,
  emptyLabel,
  issues,
}: {
  title: string;
  emptyLabel: string;
  issues: RepoIssueSummary[];
}) {
  const format = useFormatter();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {issues.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {issues.map((issue) => (
            <li key={issue.url} className="flex flex-col gap-1 px-3 py-2">
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-sm font-medium text-foreground hover:underline"
              >
                #{issue.number} · {issue.title}
              </a>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{format.dateTime(new Date(issue.createdAt), 'short')}</span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3" aria-hidden />
                  {format.number(issue.commentCount)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
