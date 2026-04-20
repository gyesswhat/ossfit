import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchIssueDetail, parseRepoFullName } from '@/lib/github/issue';
import { isRateLimitError } from '@/lib/github/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * [목적] 이슈 상세 모달에서 호출하는 단일 이슈 조회 엔드포인트.
 *        `?repo=owner/name&number=123` 형태로 호출한다.
 * [주의] rate limit은 429, 잘못된 파라미터는 400, 찾을 수 없으면 404로 구분한다.
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
  const numberParam = request.nextUrl.searchParams.get('number') ?? '';
  const parsed = parseRepoFullName(repoParam);
  const number = Number.parseInt(numberParam, 10);

  if (!parsed || !Number.isFinite(number) || number <= 0) {
    return NextResponse.json({ error: 'invalid-params' }, { status: 400 });
  }

  try {
    const issue = await fetchIssueDetail(
      session.accessToken,
      parsed.owner,
      parsed.name,
      number,
    );
    if (!issue) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    return NextResponse.json(issue);
  } catch (error) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ error: 'rate-limited' }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : 'fetch-failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
