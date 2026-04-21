import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchRepoDetail, parseRepoFullName } from '@/lib/github/repo';
import { isRateLimitError } from '@/lib/github/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * [목적] 레포 상세 모달에서 호출하는 단일 레포 조회 엔드포인트.
 *        `?repo=owner/name` 형태로 호출한다. 상세 + 기여 후보 이슈 목록을 한 번에 반환한다.
 * [주의] rate limit은 429, 잘못된 파라미터는 400, 찾을 수 없거나 비공개면 404로 구분한다.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ error: 'missing-token' }, { status: 401 });
  }

  const repoParam = request.nextUrl.searchParams.get('repo') ?? '';
  const parsed = parseRepoFullName(repoParam);
  if (!parsed) {
    return NextResponse.json({ error: 'invalid-params' }, { status: 400 });
  }

  try {
    const detail = await fetchRepoDetail(
      session.accessToken,
      parsed.owner,
      parsed.name,
    );
    if (!detail) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn('[api/github/repo] rate limited', { repo: repoParam });
      return NextResponse.json({ error: 'rate-limited' }, { status: 429 });
    }
    console.error('[api/github/repo] fetch failed', {
      repo: repoParam,
      error,
    });
    const message = error instanceof Error ? error.message : 'fetch-failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
