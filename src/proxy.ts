import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

/**
 * [목적] Next.js 16의 proxy 엔트리. next-intl 미들웨어를 사용해 locale 프리픽스를 강제하고 `/`에 접근 시 기본 locale(`/ko`)로 리다이렉트한다.
 * [주의] Next 16에서 `middleware.ts`는 deprecated. 이 파일이 `proxy` 역할을 수행한다.
 * [참고] https://next-intl.dev/docs/routing/middleware
 */
export const proxy = createIntlMiddleware(routing);

export const config = {
  // 모든 경로에 적용하되 api, 정적 파일, favicon 등은 제외.
  // `/` 매칭을 확실히 하기 위해 루트 경로를 별도로 포함.
  matcher: ['/', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
