'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { signOutAction } from '../(auth)/login/actions';

/**
 * [목적] 세션 종료 버튼. Server Action을 호출해 쿠키를 제거하고 로그인 페이지로 이동한다.
 */
export function LogoutButton({ locale }: { locale: string }) {
  const t = useTranslations('Home');
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(() => {
          void signOutAction(locale);
        });
      }}
    >
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? t('signingOut') : t('signOut')}
      </Button>
    </form>
  );
}
