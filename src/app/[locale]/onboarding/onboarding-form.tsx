'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TagPicker } from '@/components/features/tag-picker';
import { completeOnboarding } from './actions';

type Step = 1 | 2;

type Props = {
  locale: string;
  initialStackTags: string[];
  initialDomains: string[];
  personalTopics: readonly string[];
  domainOptions: readonly string[];
};

/**
 * [목적] 2단계 온보딩 UI. 1단계는 TagPicker로 카탈로그 기반 스택 편집, 2단계는 관심 도메인 선택.
 * [주의] 자유 입력을 제거해 유효하지 않은 토픽·언어가 DB에 저장되지 않도록 한다.
 *        TagPicker는 선택 상태를 부모가 관리하고, 서버 검증은 Server Action에서 한 번 더 걸러낸다.
 */
export function OnboardingForm({
  locale,
  initialStackTags,
  initialDomains,
  personalTopics,
  domainOptions,
}: Props) {
  const t = useTranslations('Onboarding');
  const [step, setStep] = useState<Step>(1);
  const [stackTags, setStackTags] = useState<string[]>(initialStackTags);
  const [domains, setDomains] = useState<string[]>(initialDomains);
  const [isPending, startTransition] = useTransition();

  const canGoNext = stackTags.length > 0;
  const canSubmit = useMemo(() => domains.length > 0, [domains]);

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
          <TagPicker
            selectedSlugs={stackTags}
            personalTopicSlugs={personalTopics}
            onChange={setStackTags}
          />
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
