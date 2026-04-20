import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { CodeBlock } from './code-block';

/**
 * [목적] Fork → Clone → 브랜치 → 커밋 → PR 순서의 기여 가이드 정적 페이지.
 *        코드 블록은 복사 버튼이 달린 클라이언트 컴포넌트로 분리해 호이스팅한다.
 * [주의] 이 라우트는 온보딩 완료 여부를 재검사하지 않는다 — 로그인만 되면 누구나 볼 수 있도록
 *        `(main)` 라우트 그룹 밖에 배치했다.
 */
export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Guide' });
  const feedT = await getTranslations({ locale, namespace: 'Feed' });

  const copyLabel = t('copy');
  const copiedLabel = t('copied');

  const steps: Array<{
    id: string;
    title: string;
    description: React.ReactNode;
    code?: string;
  }> = [
    { id: 'step1', title: t('step1Title'), description: t('step1Description') },
    {
      id: 'step2',
      title: t('step2Title'),
      description: t('step2Description', { user: 'YOUR-NAME' }),
      code: 'git clone https://github.com/YOUR-NAME/repo-name.git\ncd repo-name',
    },
    {
      id: 'step3',
      title: t('step3Title'),
      description: t('step3Description'),
      code: 'git switch -c fix/issue-123',
    },
    {
      id: 'step4',
      title: t('step4Title'),
      description: t('step4Description'),
      code: 'git add .\ngit commit -m "fix: null 체크 누락 (#123)"',
    },
    {
      id: 'step5',
      title: t('step5Title'),
      description: t('step5Description'),
      code: 'git push -u origin fix/issue-123',
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <nav>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {feedT('title')}
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>

      <aside className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <h2 className="text-sm font-semibold text-primary">{t('tipTitle')}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
          <li>{t('tip1')}</li>
          <li>{t('tip2')}</li>
          <li>{t('tip3')}</li>
        </ul>
      </aside>

      <nav aria-label={t('toc')} className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('toc')}
        </p>
        <ol className="mt-2 space-y-1 text-sm">
          {steps.map((step) => (
            <li key={step.id}>
              <a
                href={`#${step.id}`}
                className="text-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                {step.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <ol className="flex flex-col gap-8">
        {steps.map((step) => (
          <li key={step.id} id={step.id} className="flex flex-col gap-3 scroll-mt-8">
            <h2 className="text-xl font-semibold text-foreground">{step.title}</h2>
            <p className="text-sm leading-6 text-foreground">{step.description}</p>
            {step.code && (
              <CodeBlock
                code={step.code}
                copyLabel={copyLabel}
                copiedLabel={copiedLabel}
              />
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
