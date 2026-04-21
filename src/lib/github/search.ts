import { graphql, GraphqlResponseError } from '@octokit/graphql';
import { classifyTag, normalizeSlug } from './catalog';

/**
 * [목적] 사용자 스택/도메인 태그를 GitHub Search 한정자로 변환해
 *        REPOSITORY 검색으로 "살아있는 오픈소스 레포" 목록을 돌려준다.
 * [참고] https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
 */

/**
 * 정렬 옵션 화이트리스트. REPOSITORY search에서 유효한 키만 남겼다.
 * 'best-match'는 한정자 미추가, 그 외는 `sort:<key>-<order>` 형태로 쿼리에 추가된다.
 */
export const SORT_OPTIONS = [
  'best-match',
  'stars-desc',
  'updated-desc',
  'created-desc',
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const DEFAULT_SORT: SortOption = 'best-match';

export function isSortOption(value: string): value is SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(value);
}

/**
 * 최소 별 개수 프리셋. URL 파라미터 검증과 필터 UI 양쪽에서 쓴다.
 */
export const MIN_STARS_OPTIONS = [10, 50, 500, 5000] as const;
export type MinStarsOption = (typeof MIN_STARS_OPTIONS)[number];

export function isMinStarsOption(value: number): value is MinStarsOption {
  return (MIN_STARS_OPTIONS as readonly number[]).includes(value);
}

/**
 * "진짜 오픈소스" 기본 기준. 별 10개 이상을 요구해 장난감·dead repo를 컷.
 */
export const DEFAULT_MIN_STARS: MinStarsOption = 10;

/**
 * 레포 `pushed:>` 한정자 기본 신선도(일수). 최근 6개월 내 push된 레포만 기본으로 노출.
 */
export const DEFAULT_FRESHNESS_DAYS = 180;

/**
 * 기여를 전제한 "진짜 오픈소스" 라이선스 화이트리스트. 순서는 일반성/커뮤니티 규모 기준.
 * GitHub Search는 qualifier 레벨 OR를 지원하지 않으므로 caller가 병렬 쿼리로 쪼개 처리한다.
 */
export const LICENSE_WHITELIST = [
  'mit',
  'apache-2.0',
  'bsd-3-clause',
  'bsd-2-clause',
  'gpl-3.0',
  'lgpl-3.0',
  'mpl-2.0',
  'isc',
] as const;
export type LicenseSlug = (typeof LICENSE_WHITELIST)[number];

/**
 * 한 페이지당 반환할 레포 수. GitHub Search API의 페이지네이션 최대값(100)과 UI 밀도 사이의 절충.
 */
export const PAGE_SIZE = 20;

/**
 * GitHub Search API가 한 쿼리당 돌려주는 결과의 상한(1000건).
 */
export const GITHUB_SEARCH_RESULT_CAP = 1000;

/**
 * OR-병렬 검색 한 sub-query에서 미리 끌어올 레포 개수 상한.
 */
export const MULTI_PREFETCH_PER_SUBQUERY = 80;

/**
 * [목적] 공백을 포함하거나 따옴표가 필요한 값을 한정자에 안전하게 끼워넣는다.
 */
function quoteIfNeeded(value: string): string {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

export type BuildRepoSearchQueryOptions = {
  sort?: SortOption;
  minStars?: number;
  license?: string;
  /**
   * true가 아닌 false로 주면 `-is:fork`가 쿼리에 추가된다.
   */
  isFork?: false;
  /**
   * 레포 신선도 컷. 양의 정수면 `pushed:>YYYY-MM-DD`(오늘 − N일) 한정자가 추가된다.
   */
  freshnessWindowDays?: number;
};

/**
 * [목적] (today − days)의 ISO 날짜(YYYY-MM-DD)를 반환한다.
 */
export function isoDateDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.floor(days)));
  return d.toISOString().slice(0, 10);
}

/**
 * [목적] 단일 (language?, topic?, license?) 조합 → REPOSITORY Search 쿼리 문자열.
 *        카탈로그가 언어로 식별한 슬러그는 `language:`, 그 외 유효 토픽 슬러그는 `topic:`.
 * [주의] GitHub Search는 qualifier OR를 지원하지 않으므로 language/topic/license의 OR는
 *        caller(searchReposMulti)가 각각 병렬 쿼리로 쪼개서 호출한 뒤 결과를 머지한다.
 */
export function buildRepoSearchQuery(
  tags: readonly string[],
  options: BuildRepoSearchQueryOptions = {},
): string {
  const parts: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of tags) {
    const slug = normalizeSlug(rawTag);
    if (!slug || seen.has(slug)) continue;
    const kind = classifyTag(slug);
    if (!kind) continue;
    seen.add(slug);
    parts.push(`${kind}:${quoteIfNeeded(slug)}`);
  }

  const license = options.license?.trim();
  if (license) {
    parts.push(`license:${quoteIfNeeded(license)}`);
  }

  const minStars = options.minStars;
  if (typeof minStars === 'number' && Number.isFinite(minStars) && minStars > 0) {
    parts.push(`stars:>=${Math.floor(minStars)}`);
  }

  if (options.isFork === false) {
    parts.push('-is:fork');
  }

  const freshness = options.freshnessWindowDays;
  if (typeof freshness === 'number' && Number.isFinite(freshness) && freshness > 0) {
    parts.push(`pushed:>${isoDateDaysAgo(freshness)}`);
  }

  parts.push('archived:false', 'is:public');

  const sort = options.sort ?? 'best-match';
  if (sort !== 'best-match') {
    parts.push(`sort:${sort}`);
  }

  return parts.join(' ');
}

export type RepoResult = {
  id: string;
  nameWithOwner: string;
  owner: string;
  name: string;
  description: string | null;
  url: string;
  primaryLanguage: string | null;
  stargazerCount: number;
  pushedAt: string;
  createdAt: string;
  license: string | null;
  topics: string[];
  openIssueCount: number;
};

export type SearchReposResult = {
  repoCount: number;
  repos: RepoResult[];
  page: number;
  perPage: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type GraphQLRepositoryNode = {
  __typename: 'Repository' | string;
  id: string;
  nameWithOwner: string;
  name: string;
  url: string;
  description: string | null;
  stargazerCount: number;
  pushedAt: string | null;
  createdAt: string;
  owner: { login: string };
  licenseInfo: { key: string | null; spdxId: string | null; name: string | null } | null;
  primaryLanguage: { name: string } | null;
  repositoryTopics: {
    nodes: Array<{ topic: { name: string } } | null> | null;
  } | null;
  issues: { totalCount: number };
};

type GraphQLSearchReposResponse = {
  search: {
    repositoryCount: number;
    pageInfo: {
      endCursor: string | null;
      hasNextPage: boolean;
    };
    nodes: Array<GraphQLRepositoryNode | null> | null;
  };
};

const REPO_SEARCH_QUERY = /* GraphQL */ `
  query OssfitSearchRepos($searchQuery: String!, $first: Int!, $after: String) {
    search(query: $searchQuery, type: REPOSITORY, first: $first, after: $after) {
      repositoryCount
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        __typename
        ... on Repository {
          id
          nameWithOwner
          name
          url
          description
          stargazerCount
          pushedAt
          createdAt
          owner {
            login
          }
          licenseInfo {
            key
            spdxId
            name
          }
          primaryLanguage {
            name
          }
          repositoryTopics(first: 10) {
            nodes {
              topic {
                name
              }
            }
          }
          issues(states: OPEN) {
            totalCount
          }
        }
      }
    }
  }
`;

/**
 * [목적] GitHub Search API rate limit 응답 여부를 보수적으로 판정한다.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof GraphqlResponseError) {
    return error.errors?.some((e) => e.type === 'RATE_LIMITED') ?? false;
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    return status === 403 || status === 429;
  }
  return false;
}

export type SearchReposMultiInput = {
  languages: readonly string[];
  topics: readonly string[];
  licenses: readonly string[];
};

export type SearchReposMultiOptions = {
  sort?: SortOption;
  minStars?: number;
  freshnessWindowDays?: number;
  /**
   * pushedAt 기준 추가 클라이언트 컷(일). 기본은 freshnessWindowDays를 따른다.
   */
  repoStaleThresholdDays?: number;
  page?: number;
  perPage?: number;
  prefetchPerSubQuery?: number;
};

/**
 * [목적] 여러 언어 × 토픽 × 라이선스 조합에 대해 REPOSITORY Search를 병렬 호출하고,
 *        레포 id로 dedup 한 뒤 pushedAt 기준으로 stale repo를 클라이언트 사이드에서 한 번 더 컷.
 * [주의] 각 sub-query는 프리패치 상한(prefetchPerSubQuery)까지 끌어와 머지 풀을 만든다.
 *        rate-limit이 한 sub-query라도 발생하면 예외가 전체로 전파된다.
 */
export async function searchReposMulti(
  input: SearchReposMultiInput,
  accessToken: string,
  options: SearchReposMultiOptions = {},
): Promise<SearchReposResult> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(options.perPage ?? PAGE_SIZE)));
  const prefetch = Math.min(
    GITHUB_SEARCH_RESULT_CAP,
    Math.max(perPage, Math.floor(options.prefetchPerSubQuery ?? MULTI_PREFETCH_PER_SUBQUERY)),
  );

  const languageCombos = input.languages.length > 0 ? input.languages : [null];
  const topicCombos = input.topics.length > 0 ? input.topics : [null];
  const licenseCombos = input.licenses.length > 0 ? input.licenses : [null];

  const subQueries: string[] = [];
  for (const language of languageCombos) {
    for (const topic of topicCombos) {
      for (const license of licenseCombos) {
        const tags: string[] = [];
        if (language) tags.push(language);
        if (topic) tags.push(topic);
        subQueries.push(
          buildRepoSearchQuery(tags, {
            sort: options.sort,
            minStars: options.minStars,
            freshnessWindowDays: options.freshnessWindowDays,
            license: license ?? undefined,
            isFork: false,
          }),
        );
      }
    }
  }

  const client = graphql.defaults({
    headers: { authorization: `bearer ${accessToken}` },
  });

  const fetched = await Promise.all(
    subQueries.map((query) => fetchReposUpTo(client, query, prefetch)),
  );

  const merged = new Map<string, RepoResult>();
  for (const repos of fetched) {
    for (const repo of repos) {
      if (!merged.has(repo.id)) merged.set(repo.id, repo);
    }
  }

  const repoStaleThreshold =
    options.repoStaleThresholdDays ?? options.freshnessWindowDays ?? DEFAULT_FRESHNESS_DAYS;
  const repoCutoff =
    repoStaleThreshold > 0
      ? new Date(isoDateDaysAgo(repoStaleThreshold)).getTime()
      : null;

  const filtered: RepoResult[] = [];
  for (const repo of merged.values()) {
    if (repoCutoff !== null) {
      const pushedAtMs = Date.parse(repo.pushedAt);
      if (Number.isFinite(pushedAtMs) && pushedAtMs < repoCutoff) continue;
    }
    filtered.push(repo);
  }

  const sorted = sortMergedRepos(filtered, options.sort ?? DEFAULT_SORT);
  const poolSize = sorted.length;
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const pageRepos = sorted.slice(startIndex, endIndex);

  return {
    repoCount: poolSize,
    repos: pageRepos,
    page,
    perPage,
    hasPreviousPage: page > 1,
    hasNextPage: endIndex < poolSize,
  };
}

type GraphQLClient = ReturnType<typeof graphql.defaults>;

async function fetchReposUpTo(
  client: GraphQLClient,
  query: string,
  limit: number,
): Promise<RepoResult[]> {
  const pageSize = Math.min(50, Math.max(1, limit));
  const results: RepoResult[] = [];
  let cursor: string | null = null;
  while (results.length < limit) {
    const remaining = limit - results.length;
    const response: GraphQLSearchReposResponse = await client(REPO_SEARCH_QUERY, {
      searchQuery: query,
      first: Math.min(pageSize, remaining),
      after: cursor,
    });
    for (const node of response.search.nodes ?? []) {
      if (!node || node.__typename !== 'Repository') continue;
      results.push(toRepoResult(node));
    }
    cursor = response.search.pageInfo.endCursor;
    if (!response.search.pageInfo.hasNextPage || !cursor) break;
  }
  return results;
}

function toRepoResult(node: GraphQLRepositoryNode): RepoResult {
  const topics = (node.repositoryTopics?.nodes ?? [])
    .filter(
      (entry): entry is { topic: { name: string } } => Boolean(entry?.topic?.name),
    )
    .map((entry) => entry.topic.name);
  const license =
    node.licenseInfo?.spdxId ??
    node.licenseInfo?.key ??
    node.licenseInfo?.name ??
    null;
  return {
    id: node.id,
    nameWithOwner: node.nameWithOwner,
    owner: node.owner.login,
    name: node.name,
    description: node.description,
    url: node.url,
    primaryLanguage: node.primaryLanguage?.name ?? null,
    stargazerCount: node.stargazerCount,
    pushedAt: node.pushedAt ?? node.createdAt,
    createdAt: node.createdAt,
    license,
    topics,
    openIssueCount: node.issues.totalCount,
  };
}

function sortMergedRepos(repos: RepoResult[], sort: SortOption): RepoResult[] {
  const arr = repos.slice();
  switch (sort) {
    case 'stars-desc':
      return arr.sort((a, b) => b.stargazerCount - a.stargazerCount);
    case 'updated-desc':
      return arr.sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt));
    case 'created-desc':
      return arr.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    case 'best-match':
    default:
      return arr;
  }
}

/**
 * [목적] 총 레포 개수와 페이지 크기를 받아 표시 가능한 최대 페이지 수를 계산한다.
 */
export function totalPageCount(repoCount: number, perPage = PAGE_SIZE): number {
  const capped = Math.min(repoCount, GITHUB_SEARCH_RESULT_CAP);
  return Math.max(1, Math.ceil(capped / Math.max(perPage, 1)));
}

export type BuildRepoDisplayQueryInput = {
  languages: readonly string[];
  topics: readonly string[];
  licenses: readonly string[];
  sort?: SortOption;
  minStars?: number;
  freshnessWindowDays?: number;
  excludeForks?: boolean;
};

/**
 * [목적] 사용자에게 보여줄 '통합 쿼리 문자열'을 만든다. 실제 실행은 병렬로 쪼개지지만
 *        UX상 전체 조건이 한눈에 보이도록 OR 그룹을 괄호로 묶어 노출한다.
 */
export function buildRepoDisplayQuery(input: BuildRepoDisplayQueryInput): string {
  const parts: string[] = [];

  if (input.languages.length > 0) {
    parts.push(orGroup(input.languages.map((lang) => `language:${quoteIfNeeded(lang)}`)));
  }
  if (input.topics.length > 0) {
    parts.push(orGroup(input.topics.map((topic) => `topic:${quoteIfNeeded(topic)}`)));
  }
  if (input.licenses.length > 0) {
    parts.push(orGroup(input.licenses.map((license) => `license:${quoteIfNeeded(license)}`)));
  }
  if (typeof input.minStars === 'number' && input.minStars > 0) {
    parts.push(`stars:>=${Math.floor(input.minStars)}`);
  }
  if (input.excludeForks) {
    parts.push('-is:fork');
  }
  if (
    typeof input.freshnessWindowDays === 'number' &&
    input.freshnessWindowDays > 0
  ) {
    parts.push(`pushed:>${isoDateDaysAgo(input.freshnessWindowDays)}`);
  }
  parts.push('archived:false', 'is:public');
  const sort = input.sort ?? 'best-match';
  if (sort !== 'best-match') parts.push(`sort:${sort}`);
  return parts.join(' ');
}

function orGroup(parts: readonly string[]): string {
  if (parts.length === 1 && parts[0]) return parts[0];
  return `(${parts.join(' OR ')})`;
}
