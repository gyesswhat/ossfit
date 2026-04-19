'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { verifyBetaPassword, type BetaFormState } from './actions';

const initialState: BetaFormState = { status: 'idle' };

/**
 * [목적] 베타 비밀번호 입력 폼. Server Action 결과 상태에 따라 에러 메시지를 표시한다.
 * [주의] locale은 hidden input으로 전달해 액션 측에서 redirect 시 사용한다.
 */
export function BetaForm({ locale }: { locale: string }) {
  const t = useTranslations('Beta');
  const [state, formAction, isPending] = useActionState(
    verifyBetaPassword,
    initialState,
  );

  const errorMessage =
    state.status === 'invalid'
      ? t('errorInvalid')
      : state.status === 'missing-config'
        ? t('errorMissingConfig')
        : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor="beta-password" className="sr-only">
        {t('placeholder')}
      </label>
      <input
        id="beta-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder={t('placeholder')}
        className="h-11 w-full rounded-md border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
