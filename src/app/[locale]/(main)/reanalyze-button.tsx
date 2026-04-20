'use client';

import { Check, Loader2, RefreshCw } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { reanalyzeProfileAction, type ReanalyzeState } from './actions';

const initialState: ReanalyzeState = { status: 'idle' };

/**
 * [목적] "스킬 재분석" 트리거. 성공은 버튼 안에 짧게 ✓ 아이콘으로, 에러만 아래 한 줄로 표기한다.
 * [주의] useActionState의 status는 수동 초기화가 불가능하므로 로컬 타이머로 3초 후 success 표기를 내린다.
 */
export function ReanalyzeButton({ locale }: { locale: string }) {
  const t = useTranslations('Profile');
  const [state, formAction, isPending] = useActionState(
    reanalyzeProfileAction,
    initialState,
  );
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (state.status !== 'success') return;
    setShowSuccess(true);
    const timer = setTimeout(() => setShowSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  const errorMessage =
    state.status === 'missing-token'
      ? t('reanalyzeMissingToken')
      : state.status === 'unauthenticated'
        ? t('reanalyzeUnauthenticated')
        : state.status === 'error'
          ? t('reanalyzeError')
          : null;

  const icon = isPending ? (
    <Loader2 className="size-3.5 animate-spin" aria-hidden />
  ) : showSuccess ? (
    <Check className="size-3.5 text-primary" aria-hidden />
  ) : (
    <RefreshCw className="size-3.5" aria-hidden />
  );

  const label = isPending
    ? t('reanalyzing')
    : showSuccess
      ? t('reanalyzeUpdated')
      : t('reanalyze');

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="locale" value={locale} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending}
        className="gap-1.5"
      >
        {icon}
        {label}
      </Button>
      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
