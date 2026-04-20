import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { ensureUserProfile, getUserProfile } from '@/lib/profile/service';
import { OnboardingForm } from './onboarding-form';

export const DOMAIN_OPTIONS = ['spring-boot', 'kotlin', 'devops', 'etc'] as const;

/**
 * [목적] 2단계 온보딩 페이지. 이미 완료한 사용자는 홈으로 돌려보낸다.
 *        프로필이 없으면 즉석에서 분석을 돌려 생성한다(최초 로그인 직후 경로).
 * [주의] access_token이 없어 분석이 불가능한 경우 기존 row만 조회. UI에서 수동 편집은 가능하다.
 */
export default async function OnboardingPage({
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

  if (profile?.onboardingCompleted) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations({ locale, namespace: 'Onboarding' });

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm
            locale={locale}
            initialStackTags={profile?.stackTags ?? []}
            initialDomains={profile?.domains ?? []}
            personalTopics={profile?.personalTopics ?? []}
            domainOptions={DOMAIN_OPTIONS}
          />
        </CardContent>
      </Card>
    </main>
  );
}
