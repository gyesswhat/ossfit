'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { classifyTag, normalizeSlug } from '@/lib/github/catalog';
import { feedCacheTagForUser } from '@/lib/github/search-cache';
import { DOMAIN_SET } from '@/lib/profile/domains';
import { updateUserProfile } from '@/lib/profile/service';

const MAX_STACK_TAGS = 20;
const MAX_DOMAINS = 10;

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

  updateTag(feedCacheTagForUser(session.user.id));
  revalidatePath(`/${locale}/profile`);
  revalidatePath(`/${locale}`);
  return { status: 'success' };
}

export type UpdateDomainsState = {
  status: 'idle' | 'success' | 'unauthenticated' | 'error';
  errorMessage?: string;
};

/**
 * [목적] 마이페이지에서 관심 도메인(domains) 배열을 덮어쓴다.
 * [주의] 미리 정의된 DOMAIN_SET에 없는 값은 버려 DB에 예기치 못한 slug가 섞이지 않게 한다.
 */
export async function updateDomainsAction(
  _prev: UpdateDomainsState,
  formData: FormData,
): Promise<UpdateDomainsState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: 'unauthenticated' };
  }

  const localeInput = formData.get('locale')?.toString() ?? routing.defaultLocale;
  const locale = hasLocale(routing.locales, localeInput)
    ? localeInput
    : routing.defaultLocale;

  const domainsRaw = formData.getAll('domains').map((value) => value.toString());
  const domains = Array.from(
    new Set(
      domainsRaw
        .map((value) => value.trim())
        .filter((value) => DOMAIN_SET.has(value)),
    ),
  ).slice(0, MAX_DOMAINS);

  try {
    await updateUserProfile(session.user.id, { domains });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', errorMessage: message };
  }

  updateTag(feedCacheTagForUser(session.user.id));
  revalidatePath(`/${locale}/profile`);
  revalidatePath(`/${locale}`);
  return { status: 'success' };
}
