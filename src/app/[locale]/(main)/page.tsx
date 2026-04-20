import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { getBookmarkedIssueUrls } from '@/lib/bookmarks/service';
import { classifyTag, displayNameForSlug } from '@/lib/github/catalog';
import {
  buildSearchQuery,
  isRateLimitError,
  RECOMMENDED_LABELS,
  searchIssues,
  type SearchIssuesResult,
} from '@/lib/github/search';
import { ensureUserProfile, getUserProfile } from '@/lib/profile/service';
import { FeedFilters } from './feed-filters';
import { IssueFeed } from './issue-feed';
import { LogoutButton } from './logout-button';
import { ReanalyzeButton } from './reanalyze-button';

type SearchParamRecord = Record<string, string | string[] | undefined>;

/**
 * [목적] 보호된 메인 피드. 사용자 스택과 URL 필터를 합쳐 GitHub Search를 호출하고
 *        프로필 헤더 + 필터 + 이슈 카드 그리드를 렌더한다.
 * [주의] proxy.ts에서 1차 가드가 걸려 있지만 페이지에서도 세션·온보딩을 재확인한다.
 *        Search 실패 시(404 토큰 만료, 429 rate limit, 기타) 피드는 빈 상태로 두고 안내 메시지만 표시한다.
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
  const labelOverrides = readListParam(resolvedSearchParams.label);
  const languageOverrides = readListParam(resolvedSearchParams.language);
  const topicOverrides = readListParam(resolvedSearchParams.topic);

  const profileLanguages = profile.stackTags.filter(
    (tag) => classifyTag(tag) === 'language',
  );
  const profileTopics = profile.stackTags.filter(
    (tag) => classifyTag(tag) === 'topic',
  );

  const effectiveLanguages =
    languageOverrides.length > 0 ? languageOverrides : profileLanguages;
  const effectiveTopics =
    topicOverrides.length > 0 ? topicOverrides : profileTopics;
  const tags = [...effectiveLanguages, ...effectiveTopics];
  const labels =
    labelOverrides.length > 0 ? labelOverrides : ['good first issue'];
  const query = buildSearchQuery(tags, labels);

  let result: SearchIssuesResult | null = null;
  let errorKey: 'rate-limit' | 'missing-token' | 'unknown' | null = null;

  if (!session.accessToken) {
    errorKey = 'missing-token';
  } else if (tags.length === 0) {
    // 스택 태그가 없으면 검색을 시도하지 않는다 — 빈 쿼리는 노이즈만 늘린다.
    result = { issueCount: 0, issues: [] };
  } else {
    try {
      result = await searchIssues(query, session.accessToken);
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn('[page/feed] rate limited', { query });
        errorKey = 'rate-limit';
      } else {
        console.error('[page/feed] search failed', {
          query,
          tags,
          labels,
          stackTags: profile.stackTags,
          error,
        });
        errorKey = 'unknown';
      }
    }
  }

  const bookmarkedUrls = result
    ? Array.from(
        await getBookmarkedIssueUrls(
          session.user.id,
          result.issues.map((issue) => issue.url),
        ),
      )
    : [];

  const t = await getTranslations('Feed');
  const homeT = await getTranslations('Home');
  const profileT = await getTranslations('Profile');
  const displayName = session.user.name ?? session.user.email ?? 'OSSFIT';

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

      <FeedFilters
        availableLanguages={profileLanguages}
        availableTopics={profileTopics}
        defaultLabels={[RECOMMENDED_LABELS[0]]}
      />

      <section aria-labelledby="feed-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="feed-heading" className="text-lg font-semibold text-foreground">
            {t('title')}
          </h2>
          {result && (
            <span className="text-xs text-muted-foreground">
              {t('total', { count: result.issueCount })}
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

        {result && result.issues.length === 0 && !errorKey && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {tags.length === 0 ? t('emptyNoStack') : t('empty')}
            </p>
            {tags.length > 0 &&
              (labelOverrides.length > 0 ||
                languageOverrides.length > 0 ||
                topicOverrides.length > 0) && (
                <Link
                  href="/"
                  className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {t('clearAllFilters')}
                </Link>
              )}
          </div>
        )}

        {result && result.issues.length > 0 && (
          <IssueFeed
            locale={locale}
            issues={result.issues}
            initialBookmarkedUrls={bookmarkedUrls}
          />
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
