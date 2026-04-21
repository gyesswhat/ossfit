import { ExternalLink } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { listBookmarks } from '@/lib/bookmarks/service';
import { DOMAIN_OPTIONS } from '@/lib/profile/domains';
import { getUserProfile } from '@/lib/profile/service';
import { ReanalyzeButton } from '../reanalyze-button';
import { DomainEditor } from './domain-editor';
import { StackEditor } from './stack-editor';

/**
 * [목적] 마이 프로필 페이지. 스택/레벨 요약, 스택 편집 폼, 북마크 목록, 재분석 버튼을 묶어 보여준다.
 * [주의] 온보딩 미완료 사용자는 홈이 아닌 `/onboarding`으로 돌려보내 먼저 초기 설정을 마치게 한다.
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const profile = await getUserProfile(session.user.id);
  if (!profile) {
    redirect(`/${locale}/onboarding`);
  }
  if (!profile.onboardingCompleted) {
    redirect(`/${locale}/onboarding`);
  }

  const bookmarks = await listBookmarks(session.user.id);

  const t = await getTranslations('Profile');
  const format = await getFormatter();
  const displayName = session.user.name ?? session.user.email ?? 'OSSFIT';

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('pageTitle')}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('levelLabel', { level: profile.level })}
            </p>
            <p className="text-xs text-muted-foreground">{t('levelHint')}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/"
              className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t('backToFeed')}
            </Link>
            <ReanalyzeButton locale={locale} />
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('stackSectionTitle')}</CardTitle>
          <CardDescription>{t('stackSectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <StackEditor
            locale={locale}
            initialStackTags={profile.stackTags}
            personalTopics={profile.personalTopics}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('domainsSectionTitle')}</CardTitle>
          <CardDescription>{t('domainsSectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DomainEditor
            locale={locale}
            initialDomains={profile.domains}
            domainOptions={DOMAIN_OPTIONS}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('bookmarksSectionTitle')}</CardTitle>
          <CardDescription>
            {t('bookmarksCount', { count: bookmarks.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookmarks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t('bookmarksEmpty')}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {bookmarks.map((bookmark) => (
                <li
                  key={bookmark.id}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-foreground">
                      {bookmark.repoFullName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format.dateTime(new Date(bookmark.createdAt), 'short')}
                    </span>
                  </div>
                  <a
                    href={bookmark.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {bookmark.repoUrl}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
