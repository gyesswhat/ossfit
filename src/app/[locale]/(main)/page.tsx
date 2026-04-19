import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { ensureUserProfile, getUserProfile } from '@/lib/profile/service';
import { LogoutButton } from './logout-button';
import { ReanalyzeButton } from './reanalyze-button';

/**
 * [목적] 보호된 메인 홈. 세션이 없으면 로그인으로, 온보딩 미완료면 온보딩으로 리다이렉트한다.
 *        최초 진입 시 GitHub 활동을 분석해 user_profiles를 생성한다.
 * [주의] proxy.ts에서 1차 가드가 걸려 있지만 Server Action 경로 등으로 우회될 수 있어 페이지에서도 재확인한다.
 *        access_token이 JWT에서 유실된 경우 분석을 건너뛰고 기존 프로필만 조회한다.
 */
export default async function HomePage({
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

  const profile = session.accessToken
    ? await ensureUserProfile(session.user.id, session.accessToken)
    : await getUserProfile(session.user.id);

  if (!profile?.onboardingCompleted) {
    redirect(`/${locale}/onboarding`);
  }

  const t = await getTranslations('Home');
  const profileT = await getTranslations('Profile');
  const displayName = session.user.name ?? session.user.email ?? 'OSSFIT';

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {t('welcome')}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t('tagline')}</p>
      <span className="inline-flex items-center rounded-full bg-accent px-4 py-1 text-sm font-medium text-accent-foreground">
        {t('greeting', { name: displayName })}
      </span>
      <section className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {profileT('levelLabel', { level: profile.level })}
        </p>
        {profile.stackTags.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {profile.stackTags.map((tag) => (
              <Badge key={tag} variant="accent">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {profileT('stackEmpty')}
          </p>
        )}
      </section>
      <ReanalyzeButton locale={locale} />
      <LogoutButton locale={locale} />
    </main>
  );
}
