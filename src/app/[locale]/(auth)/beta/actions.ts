'use server';

import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const BETA_COOKIE = 'beta_access';
const BETA_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

export type BetaFormState = { status: 'idle' | 'invalid' | 'missing-config' };

/**
 * [목적] 베타 비밀번호를 검증하고 통과 시 `beta_access` 쿠키 설정 후 `/{locale}` 홈으로 리다이렉트한다.
 * [주의] `BETA_PASSWORD` 환경변수가 비어있으면 `missing-config` 상태를 반환해 운영자가 즉시 인지하도록 한다.
 *        실패 시 형식 통일을 위해 `redirect`(throw 기반) 대신 상태를 반환한다.
 */
export async function verifyBetaPassword(
  _prev: BetaFormState,
  formData: FormData,
): Promise<BetaFormState> {
  const password = formData.get('password')?.toString() ?? '';
  const localeInput = formData.get('locale')?.toString() ?? routing.defaultLocale;
  const locale = hasLocale(routing.locales, localeInput)
    ? localeInput
    : routing.defaultLocale;

  const expected = process.env.BETA_PASSWORD;
  if (!expected) {
    return { status: 'missing-config' };
  }

  if (password !== expected) {
    return { status: 'invalid' };
  }

  const cookieStore = await cookies();
  cookieStore.set(BETA_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: BETA_COOKIE_MAX_AGE,
  });

  return redirect({ href: '/', locale });
}
