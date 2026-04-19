'use server';

import { revalidatePath } from 'next/cache';
import { hasLocale } from 'next-intl';
import { auth } from '@/lib/auth';
import { routing } from '@/i18n/routing';
import { analyzeAndSaveProfile } from '@/lib/profile/service';

export type ReanalyzeState = {
  status: 'idle' | 'success' | 'unauthenticated' | 'missing-token' | 'error';
  errorMessage?: string;
};

/**
 * [목적] 사용자가 홈에서 "스킬 재분석" 버튼을 눌렀을 때 호출되는 Server Action.
 *        세션 토큰으로 GitHub 활동을 다시 분석하고 user_profiles를 덮어쓴다.
 * [주의] 분석 실패(rate limit, 네트워크 오류)는 상태로만 전달해 홈이 중단되지 않도록 한다.
 *        locale은 hidden input으로 전달받아 revalidatePath 경로 지정에 사용한다.
 */
export async function reanalyzeProfileAction(
  _prev: ReanalyzeState,
  formData: FormData,
): Promise<ReanalyzeState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: 'unauthenticated' };
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    return { status: 'missing-token' };
  }

  const localeInput = formData.get('locale')?.toString() ?? routing.defaultLocale;
  const locale = hasLocale(routing.locales, localeInput)
    ? localeInput
    : routing.defaultLocale;

  try {
    await analyzeAndSaveProfile(session.user.id, accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', errorMessage: message };
  }

  revalidatePath(`/${locale}`);
  return { status: 'success' };
}
