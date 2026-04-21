import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * [목적] Auth.js v5 표준 users 테이블.
 * [참고] https://authjs.dev/getting-started/adapters/drizzle
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date', withTimezone: true }),
  image: text('image'),
});

/**
 * [목적] Auth.js OAuth 계정 연결 테이블.
 * [주의] GitHub access_token은 GitHub API 호출 시 사용하므로 이 테이블에서 읽는다.
 *        필드명은 Auth.js 스펙에 맞춰 snake_case 유지 (OAuth 표준 파라미터명).
 */
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

/**
 * [목적] 사용자 스킬 프로필. GitHub 활동 분석 결과 + 온보딩 선택값.
 * [주의] stack_tags / domains는 Postgres text[] 배열. Drizzle의 .array() 사용.
 */
export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  stackTags: text('stack_tags').array().notNull().default([]),
  level: text('level').notNull().default('입문'),
  domains: text('domains').array().notNull().default([]),
  personalTopics: text('personal_topics').array().notNull().default([]),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * [목적] 사용자가 저장한 GitHub 레포 북마크. 피드가 레포-퍼스트로 바뀌면서 북마크 단위도 레포다.
 * [주의] 동일 사용자가 같은 레포를 중복 저장할 수 없도록 unique index 강제.
 */
export const bookmarks = pgTable(
  'bookmarks',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repoUrl: text('repo_url').notNull(),
    repoFullName: text('repo_full_name').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('bookmarks_user_repo_unique').on(t.userId, t.repoUrl)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
