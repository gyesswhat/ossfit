import { graphql, GraphqlResponseError } from '@octokit/graphql';
import { classifyTag, normalizeSlug } from './catalog';

/**
 * [목적] 사용자 스택/도메인 태그를 GitHub Search 한정자 문자열로 변환하고
 *        Search API(GraphQL)를 호출해 이슈 목록을 받아온다.
 * [참고] https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests
 */

/**
 * 추천 라벨 화이트리스트. 외부 입력을 그대로 쿼리에 넣지 않도록 사전 검증할 때 사용한다.
 */
export const RECOMMENDED_LABELS = ['good first issue', 'help wanted'] as const;
export type RecommendedLabel = (typeof RECOMMENDED_LABELS)[number];

/**
 * 정렬 옵션 화이트리스트. GitHub Search의 sort 한정자와 1:1 대응된다.
 * 'best-match'는 한정자를 붙이지 않으며, 그 외는 `sort:<key>-<order>` 형태로 쿼리에 추가된다.
 * [참고] https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests#sorting-results
 */
export const SORT_OPTIONS = [
  'best-match',
  'created-desc',
  'created-asc',
  'updated-desc',
  'comments-desc',
  'reactions-desc',
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const DEFAULT_SORT: SortOption = 'best-match';

export function isSortOption(value: string): value is SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(value);
}

/**
 * 최소 별 개수 프리셋. URL 파라미터 검증과 필터 UI 양쪽에서 쓴다.
 */
export const MIN_STARS_OPTIONS = [0, 10, 100, 1000] as const;
export type MinStarsOption = (typeof MIN_STARS_OPTIONS)[number];

export function isMinStarsOption(value: number): value is MinStarsOption {
  return (MIN_STARS_OPTIONS as readonly number[]).includes(value);
}

/**
 * "진짜 오픈소스" 기본 기준. 별 10개 이상을 요구해 장난감·dead repo를 컷.
 */
export const DEFAULT_MIN_STARS = 10;

/**
 * 이슈 `updated:>` 한정자와 레포 `pushedAt` 클라이언트 컷에 공통으로 쓰는 기본 신선도(일수).
 * GitHub Issues Search는 repo-pushed 한정자를 지원하지 않으므로 repo 쪽은 결과 필터링으로 처리한다.
 */
export const DEFAULT_FRESHNESS_DAYS = 180;

/**
 * 입문 레벨 기본 댓글 상한. 이미 오래 논의된 이슈보다 손이 가지 않은 이슈가 입문자에게 진입하기 쉽다.
 */
export const BEGINNER_MAX_COMMENTS = 5;

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
 * 한 페이지당 반환할 이슈 수. GitHub Search API의 페이지네이션 최대값(100)과 UI 밀도 사이의 절충.
 */
export const PAGE_SIZE = 30;

/**
 * GitHub Search API가 한 쿼리당 돌려주는 결과의 상한(1000건). 이 이상은 페이지네이션이 불가능하다.
 */
export const GITHUB_SEARCH_RESULT_CAP = 1000;

/**
 * [목적] 공백을 포함하거나 따옴표가 필요한 라벨 값을 한정자에 안전하게 끼워넣는다.
 *        예) `label:"good first issue"`. 토픽/언어는 이미 슬러그로 정규화되므로 일반적으로 불필요하다.
 */
function quoteIfNeeded(value: string): string {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

export type BuildSearchQueryOptions = {
  sort?: SortOption;
  minStars?: number;
  noAssignee?: boolean;
  /**
   * 단일 라이선스 슬러그. `license:mit` 형태로 쿼리에 추가된다.
   * 여러 라이선스를 OR 하려면 caller에서 슬러그별 쿼리를 분리해야 한다.
   */
  license?: string;
  /**
   * true가 아닌 false로 주면 `-is:fork`가 쿼리에 추가된다.
   * (진짜 OSS 기준: fork는 상류가 아니므로 기여 후보에서 제외.)
   */
  isFork?: false;
  /**
   * 이슈 신선도 컷. 양의 정수면 `updated:>YYYY-MM-DD`(오늘 − N일) 한정자가 추가된다.
   */
  freshnessWindowDays?: number;
  /**
   * 댓글 수 상한. 양의 정수면 `comments:<N` 한정자가 추가된다 (입문 레벨용).
   */
  maxComments?: number;
};

/**
 * [목적] (today − days)의 ISO 날짜(YYYY-MM-DD)를 반환한다. GitHub Search `updated:>` 한정자용.
 */
export function isoDateDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.floor(days)));
  return d.toISOString().slice(0, 10);
}

/**
 * [목적] 카탈로그 기반 스택 태그 + 라벨 + 보조 옵션 → GitHub Search 쿼리 문자열.
 *        카탈로그가 언어로 식별한 슬러그는 `language:`, 그 외 유효 토픽 슬러그는 `topic:`.
 *        카탈로그에 없고 토픽 슬러그 규칙도 깨진 값은 조용히 버린다 — 예: `#devops`, `react native`.
 * [주의] 태그가 0개면 반환 문자열은 필수 한정자만 포함하므로 GitHub이 422를 돌려줄 수 있다.
 *        호출 측에서 태그가 비었을 때 검색을 아예 건너뛰도록 분기해야 한다.
 *        `minStars`는 음수/NaN이면 무시된다. `sort`가 'best-match'이면 한정자를 추가하지 않는다.
 *        GitHub Search는 qualifier OR를 지원하지 않으므로 language/topic/license의 OR는 caller가
 *        각각 병렬 쿼리로 쪼개서 호출한 뒤 결과를 머지해야 한다 — 이 함수는 단일 조합만 다룬다.
 */
export function buildSearchQuery(
  tags: readonly string[],
  labels: readonly string[] = [],
  options: BuildSearchQueryOptions = {},
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

  for (const rawLabel of labels) {
    const label = rawLabel.trim();
    if (!label) continue;
    parts.push(`label:${quoteIfNeeded(label)}`);
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

  if (options.noAssignee) {
    parts.push('no:assignee');
  }

  const freshness = options.freshnessWindowDays;
  if (typeof freshness === 'number' && Number.isFinite(freshness) && freshness > 0) {
    parts.push(`updated:>${isoDateDaysAgo(freshness)}`);
  }

  const maxComments = options.maxComments;
  if (typeof maxComments === 'number' && Number.isFinite(maxComments) && maxComments > 0) {
    parts.push(`comments:<${Math.floor(maxComments)}`);
  }

  parts.push('type:issue', 'state:open', 'archived:false');

  const sort = options.sort ?? 'best-match';
  if (sort !== 'best-match') {
    parts.push(`sort:${sort}`);
  }

  return parts.join(' ');
}

export type IssueLabel = { name: string; color: string };

export type IssueResult = {
  id: string;
  title: string;
  url: string;
  number: number;
  createdAt: string;
  repository: {
    nameWithOwner: string;
    stargazerCount: number;
    primaryLanguage: string | null;
    pushedAt: string;
  };
  labels: IssueLabel[];
};

export type SearchIssuesResult = {
  issueCount: number;
  issues: IssueResult[];
  page: number;
  perPage: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type GraphQLSearchNode = {
  __typename: 'Issue' | 'PullRequest' | string;
  id: string;
  title: string;
  url: string;
  number: number;
  createdAt: string;
  repository: {
    nameWithOwner: string;
    stargazerCount: number;
    pushedAt: string | null;
    primaryLanguage: { name: string } | null;
  } | null;
  labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
};

type GraphQLSearchResponse = {
  search: {
    issueCount: number;
    pageInfo: {
      endCursor: string | null;
      hasNextPage: boolean;
    };
    nodes: Array<GraphQLSearchNode | null> | null;
  };
};

const SEARCH_QUERY = /* GraphQL */ `
  query OssfitSearchIssues($searchQuery: String!, $first: Int!, $after: String) {
    search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
      issueCount
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        __typename
        ... on Issue {
          id
          title
          url
          number
          createdAt
          repository {
            nameWithOwner
            stargazerCount
            pushedAt
            primaryLanguage {
              name
            }
          }
          labels(first: 10) {
            nodes {
              name
              color
            }
          }
        }
      }
    }
  }
`;

/**
 * [목적] GitHub Search API rate limit 응답 여부를 보수적으로 판정한다.
 *        Octokit GraphQL은 rate limit을 일반 GraphQLResponseError 또는 HTTP 403/429로 던진다.
 * [참고] https://docs.github.com/en/graphql/overview/resource-limitations
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

export type SearchIssuesPageOptions = {
  page?: number;
  perPage?: number;
};

/**
 * [목적] `page`(1-based)를 받아 해당 페이지의 이슈 목록을 반환한다.
 *        GraphQL search는 커서 기반이므로 page=1이면 `after=null`, page>1이면
 *        (page-1)번 커서 점프 후 실제 페이지를 조회한다.
 * [주의] 사용자 OAuth 토큰을 사용해야 검색 한도가 계정별로 분리된다.
 *        GitHub Search 결과 상한(1000건)을 넘어가면 `hasNextPage=false`로 고정된다.
 *        커서 점프는 각각 1회의 추가 요청을 쓰므로, 깊은 페이지(예: page=30)는 rate limit 소비에 주의.
 */
export async function searchIssues(
  query: string,
  accessToken: string,
  { page = 1, perPage = PAGE_SIZE }: SearchIssuesPageOptions = {},
): Promise<SearchIssuesResult> {
  const safePerPage = Math.min(Math.max(perPage, 1), 100);
  const safePage = Math.max(Math.floor(page), 1);

  const client = graphql.defaults({
    headers: { authorization: `bearer ${accessToken}` },
  });

  let cursor: string | null = null;
  let issueCount = 0;
  let hasNextPage = false;

  for (let i = 0; i < safePage - 1; i += 1) {
    const skipResponse: GraphQLSearchResponse = await client(SEARCH_QUERY, {
      searchQuery: query,
      first: safePerPage,
      after: cursor,
    });
    issueCount = skipResponse.search.issueCount;
    cursor = skipResponse.search.pageInfo.endCursor;
    hasNextPage = skipResponse.search.pageInfo.hasNextPage;
    if (!hasNextPage || !cursor) {
      return {
        issueCount,
        issues: [],
        page: safePage,
        perPage: safePerPage,
        hasPreviousPage: safePage > 1,
        hasNextPage: false,
      };
    }
  }

  const response: GraphQLSearchResponse = await client(SEARCH_QUERY, {
    searchQuery: query,
    first: safePerPage,
    after: cursor,
  });

  issueCount = response.search.issueCount;
  hasNextPage = response.search.pageInfo.hasNextPage;

  const effectiveCap = Math.min(issueCount, GITHUB_SEARCH_RESULT_CAP);
  const lastPage = Math.max(1, Math.ceil(effectiveCap / safePerPage));
  const hasNextPageCapped = hasNextPage && safePage < lastPage;

  const issues: IssueResult[] = [];
  for (const node of response.search.nodes ?? []) {
    if (!node || node.__typename !== 'Issue' || !node.repository) continue;
    issues.push({
      id: node.id,
      title: node.title,
      url: node.url,
      number: node.number,
      createdAt: node.createdAt,
      repository: {
        nameWithOwner: node.repository.nameWithOwner,
        stargazerCount: node.repository.stargazerCount,
        primaryLanguage: node.repository.primaryLanguage?.name ?? null,
        pushedAt: node.repository.pushedAt ?? node.createdAt,
      },
      labels: (node.labels?.nodes ?? [])
        .filter((label): label is { name: string; color: string } => label !== null)
        .map((label) => ({ name: label.name, color: label.color })),
    });
  }

  return {
    issueCount,
    issues,
    page: safePage,
    perPage: safePerPage,
    hasPreviousPage: safePage > 1,
    hasNextPage: hasNextPageCapped,
  };
}

/**
 * [목적] 총 이슈 개수와 페이지 크기를 받아 표시 가능한 최대 페이지 수를 계산한다.
 *        GitHub Search 결과 상한(1000)에 의해 잘린다.
 */
export function totalPageCount(issueCount: number, perPage = PAGE_SIZE): number {
  const capped = Math.min(issueCount, GITHUB_SEARCH_RESULT_CAP);
  return Math.max(1, Math.ceil(capped / Math.max(perPage, 1)));
}

/**
 * OR-병렬 검색 한 sub-query에서 미리 끌어올 이슈 개수 상한.
 * 너무 크면 rate limit, 너무 작으면 머지 후 페이지네이션이 일찍 끊긴다.
 */
export const MULTI_PREFETCH_PER_SUBQUERY = 120;

export type SearchIssuesMultiInput = {
  languages: readonly string[];
  topics: readonly string[];
  licenses: readonly string[];
  labels: readonly string[];
};

export type SearchIssuesMultiOptions = {
  sort?: SortOption;
  minStars?: number;
  noAssignee?: boolean;
  freshnessWindowDays?: number;
  repoStaleThresholdDays?: number;
  maxComments?: number;
  page?: number;
  perPage?: number;
  /**
   * sub-query 당 프리패치 상한 override. 테스트/튜닝용.
   */
  prefetchPerSubQuery?: number;
};

/**
 * [목적] 여러 언어 × 토픽 × 라이선스 조합에 대해 GitHub Search를 병렬 호출하고,
 *        이슈 id로 dedup 한 뒤 레포 pushedAt 기준으로 stale repo를 클라이언트 사이드에서 컷.
 *        GitHub Search는 qualifier 레벨 OR/`repo pushed` 한정자를 지원하지 않아 이런 머지-컷 구조가 필요하다.
 * [주의] 각 sub-query는 프리패치 상한(prefetchPerSubQuery)까지 끌어와 머지 풀을 만든다.
 *        풀이 상한을 넘어가면 pagination이 풀 기준으로 정확하지만 "진짜 전체"는 아님을 감안.
 *        rate-limit이 한 sub-query라도 발생하면 예외가 전체로 전파된다.
 */
export async function searchIssuesMulti(
  input: SearchIssuesMultiInput,
  accessToken: string,
  options: SearchIssuesMultiOptions = {},
): Promise<SearchIssuesResult> {
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
          buildSearchQuery(tags, input.labels, {
            sort: options.sort,
            minStars: options.minStars,
            noAssignee: options.noAssignee,
            freshnessWindowDays: options.freshnessWindowDays,
            maxComments: options.maxComments,
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
    subQueries.map((query) => fetchUpTo(client, query, prefetch)),
  );

  const merged = new Map<string, IssueResult>();
  for (const issues of fetched) {
    for (const issue of issues) {
      if (!merged.has(issue.id)) merged.set(issue.id, issue);
    }
  }

  const repoStaleThreshold = options.repoStaleThresholdDays ?? DEFAULT_FRESHNESS_DAYS;
  const repoCutoff =
    repoStaleThreshold > 0
      ? new Date(isoDateDaysAgo(repoStaleThreshold)).getTime()
      : null;

  const filtered: IssueResult[] = [];
  for (const issue of merged.values()) {
    if (repoCutoff !== null) {
      const pushedAtMs = Date.parse(issue.repository.pushedAt);
      if (Number.isFinite(pushedAtMs) && pushedAtMs < repoCutoff) continue;
    }
    filtered.push(issue);
  }

  const sorted = sortMergedIssues(filtered, options.sort ?? DEFAULT_SORT);
  const poolSize = sorted.length;
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const pageIssues = sorted.slice(startIndex, endIndex);

  return {
    issueCount: poolSize,
    issues: pageIssues,
    page,
    perPage,
    hasPreviousPage: page > 1,
    hasNextPage: endIndex < poolSize,
  };
}

type GraphQLClient = ReturnType<typeof graphql.defaults>;

async function fetchUpTo(
  client: GraphQLClient,
  query: string,
  limit: number,
): Promise<IssueResult[]> {
  const pageSize = Math.min(100, Math.max(1, limit));
  const results: IssueResult[] = [];
  let cursor: string | null = null;
  while (results.length < limit) {
    const remaining = limit - results.length;
    const response: GraphQLSearchResponse = await client(SEARCH_QUERY, {
      searchQuery: query,
      first: Math.min(pageSize, remaining),
      after: cursor,
    });
    for (const node of response.search.nodes ?? []) {
      if (!node || node.__typename !== 'Issue' || !node.repository) continue;
      results.push({
        id: node.id,
        title: node.title,
        url: node.url,
        number: node.number,
        createdAt: node.createdAt,
        repository: {
          nameWithOwner: node.repository.nameWithOwner,
          stargazerCount: node.repository.stargazerCount,
          primaryLanguage: node.repository.primaryLanguage?.name ?? null,
          pushedAt: node.repository.pushedAt ?? node.createdAt,
        },
        labels: (node.labels?.nodes ?? [])
          .filter((label): label is { name: string; color: string } => label !== null)
          .map((label) => ({ name: label.name, color: label.color })),
      });
    }
    cursor = response.search.pageInfo.endCursor;
    if (!response.search.pageInfo.hasNextPage || !cursor) break;
  }
  return results;
}

function sortMergedIssues(issues: IssueResult[], sort: SortOption): IssueResult[] {
  const arr = issues.slice();
  switch (sort) {
    case 'created-desc':
      return arr.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    case 'created-asc':
      return arr.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    case 'updated-desc':
      return arr.sort(
        (a, b) => Date.parse(b.repository.pushedAt) - Date.parse(a.repository.pushedAt),
      );
    case 'best-match':
    case 'comments-desc':
    case 'reactions-desc':
    default:
      return arr;
  }
}

export type BuildDisplayQueryInput = {
  languages: readonly string[];
  topics: readonly string[];
  licenses: readonly string[];
  labels: readonly string[];
  sort?: SortOption;
  minStars?: number;
  noAssignee?: boolean;
  freshnessWindowDays?: number;
  maxComments?: number;
  excludeForks?: boolean;
};

/**
 * [목적] 사용자에게 보여줄 '통합 쿼리 문자열'을 만든다. 실제 실행은 병렬로 쪼개지지만
 *        UX상 전체 조건이 한눈에 보이도록 OR 그룹을 괄호로 묶어 노출한다.
 */
export function buildDisplayQuery(input: BuildDisplayQueryInput): string {
  const parts: string[] = [];

  if (input.languages.length > 0) {
    parts.push(orGroup(input.languages.map((lang) => `language:${quoteIfNeeded(lang)}`)));
  }
  if (input.topics.length > 0) {
    parts.push(orGroup(input.topics.map((topic) => `topic:${quoteIfNeeded(topic)}`)));
  }
  for (const label of input.labels) {
    const trimmed = label.trim();
    if (trimmed) parts.push(`label:${quoteIfNeeded(trimmed)}`);
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
  if (input.noAssignee) {
    parts.push('no:assignee');
  }
  if (
    typeof input.freshnessWindowDays === 'number' &&
    input.freshnessWindowDays > 0
  ) {
    parts.push(`updated:>${isoDateDaysAgo(input.freshnessWindowDays)}`);
  }
  if (typeof input.maxComments === 'number' && input.maxComments > 0) {
    parts.push(`comments:<${Math.floor(input.maxComments)}`);
  }
  parts.push('type:issue', 'state:open', 'archived:false');
  const sort = input.sort ?? 'best-match';
  if (sort !== 'best-match') parts.push(`sort:${sort}`);
  return parts.join(' ');
}

function orGroup(parts: readonly string[]): string {
  if (parts.length === 1 && parts[0]) return parts[0];
  return `(${parts.join(' OR ')})`;
}
