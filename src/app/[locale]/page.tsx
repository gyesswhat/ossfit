import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('Home');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {t('welcome')}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t('tagline')}</p>
      <span className="inline-flex items-center rounded-full bg-accent px-4 py-1 text-sm font-medium text-accent-foreground">
        Powered by OSSFIT · Pink Theme
      </span>
    </main>
  );
}
