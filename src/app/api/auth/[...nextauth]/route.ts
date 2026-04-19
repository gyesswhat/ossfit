import { handlers } from '@/lib/auth';

/**
 * [목적] Auth.js v5 catch-all 엔드포인트. `/api/auth/signin`, `/api/auth/callback/github` 등을 처리한다.
 */
export const { GET, POST } = handlers;
