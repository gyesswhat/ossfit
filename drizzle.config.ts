import { defineConfig } from 'drizzle-kit';

/**
 * [목적] drizzle-kit push / generate 설정.
 * [주의] 마이그레이션은 unpooled 연결(Neon direct URL)로 실행한다.
 *        pooled URL은 prepared statement 제약이 있어 스키마 적용 시 실패할 수 있다.
 */
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
