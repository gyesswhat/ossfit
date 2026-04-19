'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { reanalyzeProfileAction, type ReanalyzeState } from './actions';

const initialState: ReanalyzeState = { status: 'idle' };

/**
 * [목적] "스킬 재분석" 트리거 버튼. Server Action을 호출하고 결과 상태를 메시지로 노출한다.
 * [주의] locale은 hidden input으로 전달해 Server Action에서 revalidatePath 경로에 사용한다.
 */
export function ReanalyzeButton({ locale }: { locale: string }) {
  const t = useTranslations('Profile');
  const [state, formAction, isPending] = useActionState(
    reanalyzeProfileAction,
    initialState,
  );

  const message =
    state.status === 'success'
      ? t('reanalyzeSuccess')
      : state.status === 'missing-token'
        ? t('reanalyzeMissingToken')
        : state.status === 'unauthenticated'
          ? t('reanalyzeUnauthenticated')
          : state.status === 'error'
            ? t('reanalyzeError')
            : null;

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? t('reanalyzing') : t('reanalyze')}
      </Button>
      {message && (
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
      )}
    </form>
  );
}
