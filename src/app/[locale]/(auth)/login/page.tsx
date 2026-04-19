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
import { LoginForm } from './login-form';

/**
 * [목적] GitHub OAuth 로그인 페이지. 이미 로그인된 경우 홈으로 리다이렉트한다.
 * [주의] 베타 게이트는 proxy.ts에서 선행되므로 이 페이지에 도달한 시점엔 beta_access 쿠키가 이미 존재한다.
 */
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const session = await auth();
  if (session?.user) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations({ locale, namespace: 'Login' });

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm locale={locale} />
        </CardContent>
      </Card>
    </main>
  );
}
