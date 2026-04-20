'use server';

import { revalidatePath } from 'next/cache';
import { hasLocale } from 'next-intl';
import { auth } from '@/lib/auth';
import { routing } from '@/i18n/routing';
import { toggleBookmark } from '@/lib/bookmarks/service';

export type ToggleBookmarkResult =
  | { status: 'ok'; bookmarked: boolean }
  | { status: 'unauthenticated' }
  | { status: 'invalid' }
  | { status: 'error'; message: string };

const ISSUE_URL_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/;
const REPO_FULL_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/**
 * [목적] 피드/상세 패널의 북마크 토글 Server Action.
 *        서버에서 세션·입력값을 재검증한 뒤 DB 토글 후 영향받는 경로를 revalidate 한다.
 * [주의] 클라이언트가 넘긴 issueUrl/repoFullName은 포맷 검증 후에만 저장한다.
 *        실패 응답은 throw 대신 상태로 돌려 모달에서 부드럽게 처리할 수 있게 한다.
 */
export async function toggleBookmarkAction(input: {
  locale: string;
  issueUrl: string;
  repoFullName: string;
}): Promise<ToggleBookmarkResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: 'unauthenticated' };
  }

  if (
    !ISSUE_URL_PATTERN.test(input.issueUrl) ||
    !REPO_FULL_NAME_PATTERN.test(input.repoFullName)
  ) {
    return { status: 'invalid' };
  }

  const locale = hasLocale(routing.locales, input.locale)
    ? input.locale
    : routing.defaultLocale;

  try {
    const { bookmarked } = await toggleBookmark(
      session.user.id,
      input.issueUrl,
      input.repoFullName,
    );
    revalidatePath(`/${locale}`);
    return { status: 'ok', bookmarked };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'toggle-failed';
    return { status: 'error', message };
  }
}
