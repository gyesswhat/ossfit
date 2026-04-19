import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

/**
 * [목적] Neon HTTP 기반 Drizzle 클라이언트. RSC / Route Handler에서 공유.
 * [주의] DATABASE_URL(pooled)을 사용한다. neon-http 드라이버는 요청당 1회 호출이라
 *        Vercel Serverless / Edge 환경에서 연결 풀 이슈가 없다.
 *        트랜잭션이 필요한 경우 별도 드라이버(neon-serverless ws)로 교체해야 한다.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export { schema };
