'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useFeedPending } from './feed-pending-context';

type Props = {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/**
 * [목적] 피드 하단의 이전/다음 페이지 네비게이터. URL param `page`로 상태를 영속화하고,
 *        GitHub Search 1000건 제한으로 잘린 `totalPages`를 그대로 표시한다.
 * [주의] `totalPages`가 1이면 아예 렌더하지 않는다.
 *        필터와 동일한 isPending을 공유해 페이지 이동 중에도 카드 그리드가 dim 처리된다.
 */
export function FeedPagination({
  page,
  totalPages,
  hasNextPage,
  hasPreviousPage,
}: Props) {
  const t = useTranslations('Feed');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPending, startTransition } = useFeedPending();

  if (totalPages <= 1) return null;

  function goTo(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <nav
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
      aria-label={t('paginationLabel')}
      aria-busy={isPending}
    >
      <button
        type="button"
        onClick={() => goTo(page - 1)}
        disabled={!hasPreviousPage || isPending}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronLeft className="size-3" aria-hidden />
        {t('prevPage')}
      </button>
      <span className="text-xs text-muted-foreground">
        {t('pageLabel', { page, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={() => goTo(page + 1)}
        disabled={!hasNextPage || isPending}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('nextPage')}
        <ChevronRight className="size-3" aria-hidden />
      </button>
    </nav>
  );
}
