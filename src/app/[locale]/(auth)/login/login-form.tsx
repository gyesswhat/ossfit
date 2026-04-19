'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { signInWithGitHub } from './actions';

/**
 * [목적] GitHub OAuth 로그인 버튼. Server Action을 호출해 Auth.js가 GitHub로 리다이렉트하도록 트리거한다.
 * [주의] `useTransition`으로 pending 상태를 추적한다. Server Action은 redirect를 throw하므로 then이 실행되지 않는다.
 */
export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('Login');
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(() => {
          void signInWithGitHub(locale);
        });
      }}
      className="flex flex-col gap-4"
    >
      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
