import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { LogoutButton } from './logout-button';

/**
 * [목적] 보호된 메인 홈. 세션이 없으면 로그인 페이지로 리다이렉트한다.
 * [주의] proxy.ts에서 1차 가드가 걸려 있지만 Server Action 경로 등으로 우회될 수 있어 페이지에서도 재확인한다.
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
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations('Home');
  const displayName = session.user.name ?? session.user.email ?? 'OSSFIT';

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {t('welcome')}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t('tagline')}</p>
      <span className="inline-flex items-center rounded-full bg-accent px-4 py-1 text-sm font-medium text-accent-foreground">
        {t('greeting', { name: displayName })}
      </span>
      <LogoutButton locale={locale} />
    </main>
  );
}
