'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { updateDomainsAction, type UpdateDomainsState } from './actions';

const initialState: UpdateDomainsState = { status: 'idle' };

type Props = {
  locale: string;
  initialDomains: string[];
  domainOptions: readonly string[];
};

/**
 * [목적] 관심 도메인 편집 UI. 온보딩에서 고른 도메인을 마이페이지에서 수정하도록 한다.
 * [주의] 저장 시점에만 hidden input으로 서버에 전송하고, 서버 측에서 DOMAIN_SET 화이트리스트로 재검증한다.
 */
export function DomainEditor({
  locale,
  initialDomains,
  domainOptions,
}: Props) {
  const t = useTranslations('Profile');
  const onboardingT = useTranslations('Onboarding');
  const [domains, setDomains] = useState<string[]>(initialDomains);
  const [state, formAction, isPending] = useActionState(
    updateDomainsAction,
    initialState,
  );

  function toggle(domain: string) {
    setDomains((prev) =>
      prev.includes(domain)
        ? prev.filter((value) => value !== domain)
        : [...prev, domain],
    );
  }

  const message =
    state.status === 'success'
      ? t('domainsSaveSuccess')
      : state.status === 'unauthenticated'
        ? t('reanalyzeUnauthenticated')
        : state.status === 'error'
          ? t('domainsSaveError')
          : null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {domains.map((domain) => (
        <input key={domain} type="hidden" name="domains" value={domain} />
      ))}

      <div className="flex flex-wrap gap-2">
        {domainOptions.map((domain) => {
          const selected = domains.includes(domain);
          return (
            <button
              key={domain}
              type="button"
              onClick={() => toggle(domain)}
              aria-pressed={selected}
              className={
                selected
                  ? 'rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground'
                  : 'rounded-full border border-input bg-background px-3 py-1 text-sm font-medium text-foreground hover:bg-accent'
              }
            >
              {onboardingT(`domainLabels.${domain}`)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        {message ? (
          <p
            role="status"
            className={
              state.status === 'success'
                ? 'text-xs text-muted-foreground'
                : 'text-xs text-destructive'
            }
          >
            {message}
          </p>
        ) : (
          <span aria-hidden />
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? t('domainsSaving') : t('domainsSave')}
        </Button>
      </div>
    </form>
  );
}
