import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserProfile } from '@/lib/profile/service';
import {
  buildSearchQuery,
  isRateLimitError,
  searchIssues,
} from '@/lib/github/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * [목적] 로그인 사용자의 스택 프로필을 기반으로 GitHub Search 결과를 JSON으로 반환한다.
 *        쿼리 파라미터 `label`, `language`로 필터를 덮어쓸 수 있다(반복 가능).
 * [주의] rate limit(429/403/RATE_LIMITED)은 429로 단일화해 응답한다.
 *        access_token이 없으면 401을 돌려보내 클라이언트가 재로그인 안내를 띄울 수 있게 한다.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ error: 'missing-token' }, { status: 401 });
  }

  const profile = await getUserProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: 'no-profile' }, { status: 404 });
  }

  const labelOverrides = request.nextUrl.searchParams.getAll('label');
  const languageOverrides = request.nextUrl.searchParams.getAll('language');

  const tags =
    languageOverrides.length > 0 ? languageOverrides : profile.stackTags;
  const labels = labelOverrides.length > 0 ? labelOverrides : ['good first issue'];

  const query = buildSearchQuery(tags, labels);

  try {
    const result = await searchIssues(query, session.accessToken);
    return NextResponse.json({ query, ...result });
  } catch (error) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ error: 'rate-limited', query }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : 'search-failed';
    return NextResponse.json({ error: message, query }, { status: 502 });
  }
}
