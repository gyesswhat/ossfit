'use client';

import { useEffect, useState, useTransition } from 'react';
import { Bookmark, ExternalLink, MessageCircle, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { IssueDetail } from '@/lib/github/issue';
import type { IssueResult } from '@/lib/github/search';
import { toggleBookmarkAction } from './bookmark-actions';

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; detail: IssueDetail }
  | { status: 'error'; messageKey: 'rate-limit' | 'missing-token' | 'unknown' };

type Props = {
  locale: string;
  issue: IssueResult | null;
  initialBookmarked: boolean;
  onClose: () => void;
  onBookmarkChange: (issueUrl: string, bookmarked: boolean) => void;
};

/**
 * [목적] 카드 클릭 시 열리는 이슈 상세 모달. bodyHTML을 가져와 렌더하고 북마크 토글을 제공한다.
 * [주의] `bodyHTML`은 GitHub이 sanitize한 값이라 dangerouslySetInnerHTML 사용이 허용된다.
 *        ESC 키·배경 클릭으로 닫을 수 있게 하되, 배경 스크롤은 잠가 시선 분산을 막는다.
 */
export function IssueDetailModal({
  locale,
  issue,
  initialBookmarked,
  onClose,
  onBookmarkChange,
}: Props) {
  const t = useTranslations('Feed');
  const format = useFormatter();
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBookmarked(initialBookmarked);
  }, [initialBookmarked, issue?.url]);

  useEffect(() => {
    if (!issue) return;
    const controller = new AbortController();
    setState({ status: 'loading' });
    setToggleError(null);

    const url = `/api/github/issue?repo=${encodeURIComponent(
      issue.repository.nameWithOwner,
    )}&number=${issue.number}`;

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
        const detail = (await res.json()) as IssueDetail;
        setState({ status: 'ready', detail });
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setState({ status: 'error', messageKey: 'unknown' });
      });

    return () => controller.abort();
  }, [issue]);

  useEffect(() => {
    if (!issue) return;
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
  }, [issue, onClose]);

  if (!issue) return null;

  function handleBookmark() {
    if (!issue) return;
    setToggleError(null);
    startTransition(async () => {
      const result = await toggleBookmarkAction({
        locale,
        issueUrl: issue.url,
        repoFullName: issue.repository.nameWithOwner,
      });
      if (result.status === 'ok') {
        setBookmarked(result.bookmarked);
        onBookmarkChange(issue.url, result.bookmarked);
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
      aria-labelledby="issue-detail-title"
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
            {issue.repository.nameWithOwner} · #{issue.number}
          </p>
          <h2
            id="issue-detail-title"
            className="text-xl font-semibold text-foreground"
          >
            {issue.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {t('createdAt', {
                date: format.dateTime(new Date(issue.createdAt), 'short'),
              })}
            </span>
            {state.status === 'ready' && (
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3" aria-hidden />
                {format.number(state.detail.comments)}
              </span>
            )}
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
              <a href={issue.url} target="_blank" rel="noopener noreferrer">
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

        <div className="p-6">
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
            <article
              className="markdown-body prose prose-sm max-w-none text-sm leading-6 text-foreground"
              dangerouslySetInnerHTML={{ __html: state.detail.bodyHTML }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
