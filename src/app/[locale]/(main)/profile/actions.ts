'use server';

import { revalidatePath } from 'next/cache';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { classifyTag, normalizeSlug } from '@/lib/github/catalog';
import { updateUserProfile } from '@/lib/profile/service';

const MAX_STACK_TAGS = 20;

export type UpdateStackState = {
  status: 'idle' | 'success' | 'unauthenticated' | 'error';
  errorMessage?: string;
};

/**
 * [목적] 프로필 페이지에서 사용자의 stack_tags를 덮어쓴다.
 * [주의] FormData의 `stackTags` 반복 필드를 정규화·중복 제거·상한 컷 후 저장한다.
 *        재분석과 달리 GitHub API를 호출하지 않아 rate limit과 무관하다.
 */
export async function updateStackAction(
  _prev: UpdateStackState,
  formData: FormData,
): Promise<UpdateStackState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: 'unauthenticated' };
  }

  const localeInput = formData.get('locale')?.toString() ?? routing.defaultLocale;
  const locale = hasLocale(routing.locales, localeInput)
    ? localeInput
    : routing.defaultLocale;

  const stackTagsRaw = formData.getAll('stackTags').map((value) => value.toString());
  const stackTags = Array.from(
    new Set(
      stackTagsRaw
        .map((tag) => normalizeSlug(tag))
        .filter((slug) => classifyTag(slug) !== null),
    ),
  ).slice(0, MAX_STACK_TAGS);

  try {
    await updateUserProfile(session.user.id, { stackTags });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', errorMessage: message };
  }

  revalidatePath(`/${locale}/profile`);
  revalidatePath(`/${locale}`);
  return { status: 'success' };
}
