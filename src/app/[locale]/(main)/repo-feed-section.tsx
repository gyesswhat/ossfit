import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listBookmarkedRepoUrlsForUser } from '@/lib/bookmarks/service';
import {
  isRateLimitError,
  totalPageCount,
  type MinStarsOption,
  type SearchReposResult,
  type SortOption,
} from '@/lib/github/search';
import { getCachedSearchReposMulti } from '@/lib/github/search-cache';
import { FeedPagination } from './feed-pagination';
import { RepoFeed } from './repo-feed';

type Props = {
  locale: string;
  userId: string;
  accessToken: string | undefined;
  languages: readonly string[];
  topics: readonly string[];
  licenses: readonly string[];
  sort: SortOption;
  minStars: MinStarsOption;
  freshnessWindowDays: number;
  page: number;
  hasOverridingFilters: boolean;
};

/**
 * [목적] 검색·북마크 fetch 와 결과 렌더를 담당하는 async 서버 컴포넌트.
 *        page.tsx의 동기 영역(헤더/필터/검색기준)은 즉시 HTML로 흘러내리고,
 *        이 컴포넌트만 Suspense fallback 뒤에서 스트리밍으로 도착한다.
 * [주의] 검색과 사용자 북마크 SELECT는 Promise.all로 병렬 실행한 뒤 in-memory intersect.
 *        검색 자체는 5분 unstable_cache로 동일 (user, 필터) 재진입을 GraphQL 0회로 만든다.
 */
export async function RepoFeedSection({
  locale,
  userId,
  accessToken,
  languages,
  topics,
  licenses,
  sort,
  minStars,
  freshnessWindowDays,
  page,
  hasOverridingFilters,
}: Props) {
  const t = await getTranslations('Feed');

  if (!accessToken) {
    return <ErrorPanel message={t('errorMissingToken')} />;
  }

  let result: SearchReposResult | null = null;
  let userBookmarkedUrls: Set<string> = new Set();
  let errorKey: 'rate-limit' | 'unknown' | null = null;

  try {
    const [searchResult, bookmarkedSet] = await Promise.all([
      getCachedSearchReposMulti(
        userId,
        accessToken,
        { languages, topics, licenses },
        {
          sort,
          minStars,
          freshnessWindowDays,
          repoStaleThresholdDays: freshnessWindowDays,
          page,
        },
      ),
      listBookmarkedRepoUrlsForUser(userId),
    ]);
    result = searchResult;
    userBookmarkedUrls = bookmarkedSet;
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn('[repo-feed-section] rate limited', {
        languages,
        topics,
      });
      errorKey = 'rate-limit';
    } else {
      console.error('[repo-feed-section] repo search failed', {
        languages,
        topics,
        error,
      });
      errorKey = 'unknown';
    }
  }

  if (errorKey === 'rate-limit') {
    return <ErrorPanel message={t('errorRateLimit')} />;
  }
  if (errorKey === 'unknown' || !result) {
    return <ErrorPanel message={t('errorUnknown')} />;
  }

  const visibleBookmarked = result.repos
    .map((repo) => repo.url)
    .filter((url) => userBookmarkedUrls.has(url));

  const totalPages = totalPageCount(result.repoCount);

  return (
    <>
      <div className="flex items-baseline justify-end">
        <span className="text-xs text-muted-foreground">
          {t('total', { count: result.repoCount })}
        </span>
      </div>

      {result.repos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          {hasOverridingFilters && (
            <Link
              href="/"
              className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t('clearAllFilters')}
            </Link>
          )}
        </div>
      ) : (
        <>
          <RepoFeed
            locale={locale}
            repos={result.repos}
            initialBookmarkedUrls={visibleBookmarked}
          />
          <FeedPagination
            page={result.page}
            totalPages={totalPages}
            hasNextPage={result.hasNextPage}
            hasPreviousPage={result.hasPreviousPage}
          />
        </>
      )}
    </>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
