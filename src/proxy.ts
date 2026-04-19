import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const BETA_COOKIE = 'beta_access';

/**
 * [목적] next-intl 라우팅 + 베타 비밀번호 게이트 결합. `beta_access` 쿠키 없으면 `/{locale}/beta`로 리다이렉트한다.
 * [주의] Next 16에서 `middleware.ts`는 deprecated. 이 파일이 `proxy` 역할을 수행한다.
 * [참고] https://next-intl.dev/docs/routing/middleware
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 베타 페이지 자체는 무한 리다이렉트 방지를 위해 게이트를 건너뛴다.
  const isBetaPath =
    pathname === '/beta' ||
    pathname.startsWith('/beta/') ||
    routing.locales.some(
      (locale) =>
        pathname === `/${locale}/beta` || pathname.startsWith(`/${locale}/beta/`),
    );

  const hasBetaAccess = request.cookies.get(BETA_COOKIE)?.value === '1';

  if (!hasBetaAccess && !isBetaPath) {
    // URL에서 locale을 감지하지 못하면 기본 locale을 사용한다.
    const detectedLocale =
      routing.locales.find(
        (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
      ) ?? routing.defaultLocale;

    return NextResponse.redirect(new URL(`/${detectedLocale}/beta`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  // 모든 경로에 적용하되 api, 정적 파일, favicon 등은 제외.
  // `/` 매칭을 확실히 하기 위해 루트 경로를 별도로 포함.
  matcher: ['/', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
