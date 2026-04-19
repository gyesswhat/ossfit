'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { completeOnboarding } from './actions';

type Step = 1 | 2;

type Props = {
  locale: string;
  initialStackTags: string[];
  initialDomains: string[];
  domainOptions: readonly string[];
};

/**
 * [목적] 2단계 온보딩 UI. 1단계는 스택 태그 편집, 2단계는 관심 도메인 선택.
 * [주의] 제출은 Server Action `completeOnboarding`에 위임하고, 폼에 hidden input으로 선택값을 복제 전달한다.
 *        클라이언트에서 버튼 이동만 관리하고 최종 저장은 서버에서 검증·적용한다.
 */
export function OnboardingForm({
  locale,
  initialStackTags,
  initialDomains,
  domainOptions,
}: Props) {
  const t = useTranslations('Onboarding');
  const [step, setStep] = useState<Step>(1);
  const [stackTags, setStackTags] = useState<string[]>(initialStackTags);
  const [newTag, setNewTag] = useState('');
  const [domains, setDomains] = useState<string[]>(initialDomains);
  const [isPending, startTransition] = useTransition();

  const canGoNext = stackTags.length > 0;
  const canSubmit = useMemo(() => domains.length > 0, [domains]);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    setStackTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setNewTag('');
  }

  function removeTag(tag: string) {
    setStackTags((prev) => prev.filter((value) => value !== tag));
  }

  function toggleDomain(domain: string) {
    setDomains((prev) =>
      prev.includes(domain) ? prev.filter((value) => value !== domain) : [...prev, domain],
    );
  }

  async function handleSubmit() {
    const formData = new FormData();
    for (const tag of stackTags) formData.append('stackTags', tag);
    for (const domain of domains) formData.append('domains', domain);
    startTransition(() => {
      void completeOnboarding(locale, formData);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-center justify-center gap-3 text-sm">
        {[1, 2].map((n) => (
          <li
            key={n}
            className={
              n === step
                ? 'flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground'
                : 'flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground'
            }
          >
            {n}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="flex flex-col gap-4" aria-labelledby="onboarding-step1">
          <div className="space-y-1">
            <h2 id="onboarding-step1" className="text-lg font-semibold">
              {t('step1Title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('step1Description')}</p>
          </div>
          <div className="flex min-h-10 flex-wrap gap-2">
            {stackTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('stackEmpty')}</p>
            ) : (
              stackTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  aria-label={t('removeTag', { tag })}
                >
                  {tag} ×
                </button>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(event) => setNewTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag(newTag);
                }
              }}
              placeholder={t('stackPlaceholder')}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <Button type="button" variant="outline" onClick={() => addTag(newTag)}>
              {t('addTag')}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canGoNext}
            >
              {t('next')}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4" aria-labelledby="onboarding-step2">
          <div className="space-y-1">
            <h2 id="onboarding-step2" className="text-lg font-semibold">
              {t('step2Title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('step2Description')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {domainOptions.map((domain) => {
              const selected = domains.includes(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  aria-pressed={selected}
                  className={
                    selected
                      ? 'rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors'
                      : 'rounded-full border border-input bg-background px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent'
                  }
                >
                  {t(`domainLabels.${domain}`)}
                </button>
              );
            })}
          </div>
          {domains.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {domains.map((domain) => (
                <Badge key={domain} variant="accent">
                  {t(`domainLabels.${domain}`)}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              {t('back')}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
            >
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
