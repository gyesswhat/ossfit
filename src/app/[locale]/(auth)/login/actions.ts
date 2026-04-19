'use server';

import { signIn, signOut } from '@/lib/auth';

/**
 * [목적] GitHub OAuth 로그인 플로우 시작. 성공 시 로그인한 locale의 홈(`/{locale}`)으로 돌아온다.
 * [주의] Server Action 내부 호출이므로 Auth.js가 자동으로 redirect를 throw한다.
 */
export async function signInWithGitHub(locale: string) {
  await signIn('github', { redirectTo: `/${locale}` });
}

/**
 * [목적] 세션 쿠키 제거 후 지정 locale의 로그인 페이지로 이동.
 */
export async function signOutAction(locale: string) {
  await signOut({ redirectTo: `/${locale}/login` });
}
