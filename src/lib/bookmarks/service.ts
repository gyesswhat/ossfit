import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookmarks, type Bookmark } from '@/lib/db/schema';

/**
 * [목적] 레포 북마크 테이블 CRUD 래퍼. Server Action / RSC에서 공유한다.
 * [주의] 모든 조회는 user_id와 함께 필터링해 타 사용자 데이터 노출을 방지한다.
 */

export type ToggleResult = { bookmarked: boolean };

/**
 * [목적] 레포 북마크 상태를 토글한다. 이미 존재하면 제거, 없으면 추가.
 */
export async function toggleBookmark(
  userId: string,
  repoUrl: string,
  repoFullName: string,
): Promise<ToggleResult> {
  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.repoUrl, repoUrl)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.repoUrl, repoUrl)));
    return { bookmarked: false };
  }

  await db
    .insert(bookmarks)
    .values({ userId, repoUrl, repoFullName })
    .onConflictDoNothing();
  return { bookmarked: true };
}

/**
 * [목적] 사용자의 모든 레포 북마크를 최신순으로 조회.
 */
export async function listBookmarks(userId: string): Promise<Bookmark[]> {
  return db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt));
}

/**
 * [목적] 주어진 레포 URL 목록 중 사용자가 북마크한 것들만 Set으로 반환.
 */
export async function getBookmarkedRepoUrls(
  userId: string,
  repoUrls: readonly string[],
): Promise<Set<string>> {
  if (repoUrls.length === 0) return new Set();
  const rows = await db
    .select({ repoUrl: bookmarks.repoUrl })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        inArray(bookmarks.repoUrl, [...repoUrls]),
      ),
    );
  return new Set(rows.map((row) => row.repoUrl));
}
