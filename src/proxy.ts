import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';

const intlMiddleware = createIntlMiddleware(routing);

const BETA_COOKIE = 'beta_access';

/**
 * [목적] `/{locale}/{segment}` 또는 prefix 없는 `/{segment}` 경로 일치 여부를 판정.
 */
function matchesPublicSegment(pathname: string, segment: string): boolean {
  if (pathname === `/${segment}` || pathname.startsWith(`/${segment}/`)) {
    return true;
  }
  return routing.locales.some(
    (locale) =>
      pathname === `/${locale}/${segment}` ||
      pathname.startsWith(`/${locale}/${segment}/`),
  );
}

/**
 * [목적] next-intl 라우팅 + 베타 게이트 + Auth.js 세션 가드. 베타/로그인 페이지 외 접근은 로그인된 사용자만 허용.
 * [주의] Next 16에서 `middleware.ts`는 deprecated. 이 파일이 `proxy` 역할을 한다.
 *        실행 순서: 베타 쿠키 → 세션 → next-intl locale 라우팅. matcher에서 `/api/*`와 정적 자원을 제외해 Auth.js 콜백을 건드리지 않는다.
 * [참고] https://next-intl.dev/docs/routing/middleware
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isBetaPath = matchesPublicSegment(pathname, 'beta');
  const isLoginPath = matchesPublicSegment(pathname, 'login');

  const detectedLocale =
    routing.locales.find(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    ) ?? routing.defaultLocale;

  const hasBetaAccess = request.cookies.get(BETA_COOKIE)?.value === '1';
  if (!hasBetaAccess && !isBetaPath) {
    return NextResponse.redirect(new URL(`/${detectedLocale}/beta`, request.url));
  }

  if (!isBetaPath && !isLoginPath) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(
        new URL(`/${detectedLocale}/login`, request.url),
      );
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
