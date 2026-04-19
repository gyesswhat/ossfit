import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userProfiles, type UserProfile } from '@/lib/db/schema';
import {
  deriveSkillProfile,
  fetchGitHubActivity,
} from '@/lib/github/analyze';

/**
 * [목적] 사용자 프로필을 조회. 없으면 null.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * [목적] GitHub 활동을 분석해 user_profiles에 upsert한다. stack/level만 갱신하고 도메인·온보딩 상태는 유지.
 * [주의] 최초 호출 시 row가 없으면 insert. 이미 존재하면 stack_tags/level/updated_at만 덮어쓴다.
 *        온보딩 중 수동 편집한 stack_tags는 재분석 시 덮어쓰여질 수 있음을 유의.
 */
export async function analyzeAndSaveProfile(
  userId: string,
  accessToken: string,
): Promise<UserProfile> {
  const activity = await fetchGitHubActivity(accessToken);
  const { stackTags, level } = deriveSkillProfile(activity);

  const now = new Date();
  const [row] = await db
    .insert(userProfiles)
    .values({
      userId,
      stackTags,
      level,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { stackTags, level, updatedAt: now },
    })
    .returning();

  if (!row) {
    throw new Error('user_profiles upsert가 row를 반환하지 않았습니다.');
  }
  return row;
}

/**
 * [목적] 프로필이 없으면 분석을 실행해 생성하고, 있으면 그대로 반환한다.
 * [주의] 최초 로그인 직후 홈 진입 시점에서 호출하도록 설계. 네트워크 비용을 반복 발생시키지 않는다.
 */
export async function ensureUserProfile(
  userId: string,
  accessToken: string,
): Promise<UserProfile> {
  const existing = await getUserProfile(userId);
  if (existing) return existing;
  return analyzeAndSaveProfile(userId, accessToken);
}

/**
 * [목적] 온보딩/프로필 편집에서 사용하는 부분 업데이트.
 */
export async function updateUserProfile(
  userId: string,
  patch: Partial<
    Pick<UserProfile, 'stackTags' | 'domains' | 'onboardingCompleted' | 'level'>
  >,
): Promise<UserProfile> {
  const [row] = await db
    .update(userProfiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId))
    .returning();

  if (!row) {
    throw new Error(`user_profiles row가 존재하지 않습니다: ${userId}`);
  }
  return row;
}
