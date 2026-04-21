import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { getBookmarkedRepoUrls } from '@/lib/bookmarks/service';
import { classifyTag, displayNameForSlug } from '@/lib/github/catalog';
import {
  buildRepoDisplayQuery,
  DEFAULT_FRESHNESS_DAYS,
  DEFAULT_MIN_STARS,
  DEFAULT_SORT,
  isRateLimitError,
  isSortOption,
  LICENSE_WHITELIST,
  MIN_STARS_OPTIONS,
  searchReposMulti,
  totalPageCount,
  type MinStarsOption,
  type SearchReposResult,
  type SortOption,
} from '@/lib/github/search';
import { ensureUserProfile, getUserProfile } from '@/lib/profile/service';
import { FeedFilters } from './feed-filters';
import { FeedPagination } from './feed-pagination';
import { LogoutButton } from './logout-button';
import { ReanalyzeButton } from './reanalyze-button';
import { RepoFeed } from './repo-feed';
import { SearchCriteria } from './search-criteria';

type SearchParamRecord = Record<string, string | string[] | undefined>;

/**
 * [목적] 보호된 메인 피드. 사용자 스택과 URL 필터를 합쳐 GitHub REPOSITORY Search를 호출하고
 *        검색 기준 안내 + 필터 + 레포 카드 그리드 + 페이지네이션을 렌더한다.
 *        이슈는 카드 안에 넣지 않고, 카드 클릭 시 열리는 상세 모달에서만 노출된다.
 */
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamRecord>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const profile = session.accessToken
    ? await ensureUserProfile(session.user.id, session.accessToken)
    : await getUserProfile(session.user.id);

  if (!profile?.onboardingCompleted) {
    redirect(`/${locale}/onboarding`);
  }

  const resolvedSearchParams = await searchParams;
  const languageOverrides = readListParam(resolvedSearchParams.language);
  const topicOverrides = readListParam(resolvedSearchParams.topic);

  const profileLanguages = profile.stackTags.filter(
    (tag) => classifyTag(tag) === 'language',
  );
  const profileTopics = profile.stackTags.filter(
    (tag) => classifyTag(tag) === 'topic',
  );

  const effectiveLanguages = languageOverrides;
  const effectiveTopics = topicOverrides;

  const sortParam = readScalarParam(resolvedSearchParams.sort);
  const sort: SortOption =
    sortParam && isSortOption(sortParam) ? sortParam : DEFAULT_SORT;

  const minStarsOverride = readMinStars(
    readScalarParam(resolvedSearchParams.minStars),
  );
  const minStars = minStarsOverride > 0 ? minStarsOverride : DEFAULT_MIN_STARS;
  const page = readPage(readScalarParam(resolvedSearchParams.page));

  const licenses = [...LICENSE_WHITELIST];
  const freshnessWindowDays = DEFAULT_FRESHNESS_DAYS;

  const rawQuery = buildRepoDisplayQuery({
    languages: effectiveLanguages,
    topics: effectiveTopics,
    licenses,
    sort,
    minStars,
    freshnessWindowDays,
    excludeForks: true,
  });

  let result: SearchReposResult | null = null;
  let errorKey: 'rate-limit' | 'missing-token' | 'unknown' | null = null;

  if (!session.accessToken) {
    errorKey = 'missing-token';
  } else {
    try {
      result = await searchReposMulti(
        {
          languages: effectiveLanguages,
          topics: effectiveTopics,
          licenses,
        },
        session.accessToken,
        {
          sort,
          minStars,
          freshnessWindowDays,
          repoStaleThresholdDays: DEFAULT_FRESHNESS_DAYS,
          page,
        },
      );
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn('[page/feed] rate limited', { rawQuery });
        errorKey = 'rate-limit';
      } else {
        console.error('[page/feed] repo search failed', {
          rawQuery,
          languages: effectiveLanguages,
          topics: effectiveTopics,
          stackTags: profile.stackTags,
          error,
        });
        errorKey = 'unknown';
      }
    }
  }

  const bookmarkedUrls = result
    ? Array.from(
        await getBookmarkedRepoUrls(
          session.user.id,
          result.repos.map((repo) => repo.url),
        ),
      )
    : [];

  const t = await getTranslations('Feed');
  const homeT = await getTranslations('Home');
  const profileT = await getTranslations('Profile');
  const displayName = session.user.name ?? session.user.email ?? 'OSSFIT';

  const totalPages = result ? totalPageCount(result.repoCount) : 1;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {homeT('greeting', { name: displayName })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {profileT('levelLabel', { level: profile.level })}
          </p>
        </div>
        {profile.stackTags.length > 0 ? (
          <div className="flex flex-col gap-2">
            {profileLanguages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {profileT('stackLanguagesLabel')}
                </span>
                {profileLanguages.map((tag) => (
                  <Badge key={tag} variant="accent">
                    {displayNameForSlug(tag)}
                  </Badge>
                ))}
              </div>
            )}
            {profileTopics.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {profileT('stackTopicsLabel')}
                </span>
                {profileTopics.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {displayNameForSlug(tag)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{profileT('stackEmpty')}</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/guide"
            className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
          >
            {t('guideLink')}
          </Link>
          <Link
            href="/profile"
            className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
          >
            {profileT('profileLink')}
          </Link>
          <ReanalyzeButton locale={locale} />
          <LogoutButton locale={locale} />
        </div>
      </header>

      <SearchCriteria
        languages={effectiveLanguages}
        topics={effectiveTopics}
        licenses={licenses}
        languageSource={languageOverrides.length > 0 ? 'custom' : 'default'}
        topicSource={topicOverrides.length > 0 ? 'custom' : 'default'}
        sort={sort}
        minStars={minStars}
        freshnessWindowDays={freshnessWindowDays}
        excludeForks
        rawQuery={rawQuery}
        hasStack
      />

      <FeedFilters
        availableLanguages={profileLanguages}
        availableTopics={profileTopics}
      />

      <section aria-labelledby="feed-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="feed-heading" className="text-lg font-semibold text-foreground">
            {t('title')}
          </h2>
          {result && (
            <span className="text-xs text-muted-foreground">
              {t('total', { count: result.repoCount })}
            </span>
          )}
        </div>

        {errorKey === 'rate-limit' && (
          <ErrorPanel message={t('errorRateLimit')} />
        )}
        {errorKey === 'missing-token' && (
          <ErrorPanel message={t('errorMissingToken')} />
        )}
        {errorKey === 'unknown' && <ErrorPanel message={t('errorUnknown')} />}

        {result && result.repos.length === 0 && !errorKey && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
            {(languageOverrides.length > 0 ||
              topicOverrides.length > 0 ||
              sortParam !== null ||
              minStarsOverride > 0 ||
              page > 1) && (
              <Link
                href="/"
                className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
              >
                {t('clearAllFilters')}
              </Link>
            )}
          </div>
        )}

        {result && result.repos.length > 0 && (
          <>
            <RepoFeed
              locale={locale}
              repos={result.repos}
              initialBookmarkedUrls={bookmarkedUrls}
            />
            <FeedPagination
              page={result.page}
              totalPages={totalPages}
              hasNextPage={result.hasNextPage}
              hasPreviousPage={result.hasPreviousPage}
            />
          </>
        )}
      </section>
    </main>
  );
}

function readListParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => v.length > 0);
  return value.length > 0 ? [value] : [];
}

function readScalarParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : null;
}

function readMinStars(value: string | null): MinStarsOption | 0 {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.max(0, Math.floor(parsed));
  return (MIN_STARS_OPTIONS as readonly number[]).includes(rounded)
    ? (rounded as MinStarsOption)
    : 0;
}

function readPage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
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
