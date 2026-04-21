import { unstable_cache } from 'next/cache';
import {
  searchReposMulti,
  type SearchReposMultiInput,
  type SearchReposMultiOptions,
  type SearchReposResult,
} from './search';

/**
 * [목적] 사용자별 피드 검색 결과를 5분 TTL로 캐시하기 위한 next/cache 헬퍼.
 *        accessToken은 캐시 키에서 의도적으로 제외(클로저로 전달)하여 토큰 회전에 따른 캐시 파편화를 막는다.
 * [주의] 캐시 무효화는 `feedCacheTagForUser(userId)` 태그를 updateTag로 끊는다.
 *        무효화 포인트: 프로필(stack/도메인) 저장, 재분석 성공, 북마크 토글.
 */

const FEED_CACHE_TTL_SECONDS = 300;

/**
 * 사용자 단위 피드 캐시 태그. updateTag/revalidateTag 로 일괄 무효화한다.
 */
export function feedCacheTagForUser(userId: string): string {
  return `feed:user:${userId}`;
}

function normalizeList(values: readonly string[]): string {
  return [...values].map((v) => v.toLowerCase()).sort().join('|');
}

function buildCacheKey(
  userId: string,
  input: SearchReposMultiInput,
  options: SearchReposMultiOptions,
): string[] {
  return [
    'feed',
    userId,
    normalizeList(input.languages),
    normalizeList(input.topics),
    normalizeList(input.licenses),
    options.sort ?? 'best-match',
    String(options.minStars ?? 0),
    String(options.freshnessWindowDays ?? 0),
    String(options.repoStaleThresholdDays ?? options.freshnessWindowDays ?? 0),
    String(options.page ?? 1),
    String(options.perPage ?? 0),
  ];
}

/**
 * [목적] searchReposMulti 호출을 사용자/필터 조합 단위로 5분 캐시한다.
 * [주의] accessToken/input/options는 클로저로 전달하므로 unstable_cache의 인자 직렬화 키에 들어가지 않는다.
 *        캐시 히트 시 GraphQL 호출 자체가 일어나지 않아 OAuth 토큰의 차이는 결과에 영향을 주지 않는다.
 */
export async function getCachedSearchReposMulti(
  userId: string,
  accessToken: string,
  input: SearchReposMultiInput,
  options: SearchReposMultiOptions,
): Promise<SearchReposResult> {
  const keyParts = buildCacheKey(userId, input, options);
  const cached = unstable_cache(
    async () => searchReposMulti(input, accessToken, options),
    keyParts,
    {
      tags: [feedCacheTagForUser(userId)],
      revalidate: FEED_CACHE_TTL_SECONDS,
    },
  );
  return cached();
}
