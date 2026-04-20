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
};

/**
 * [목적] 카탈로그 기반 스택 태그 + 라벨 + 보조 옵션 → GitHub Search 쿼리 문자열.
 *        카탈로그가 언어로 식별한 슬러그는 `language:`, 그 외 유효 토픽 슬러그는 `topic:`.
 *        카탈로그에 없고 토픽 슬러그 규칙도 깨진 값은 조용히 버린다 — 예: `#devops`, `react native`.
 * [주의] 태그가 0개면 반환 문자열은 필수 한정자만 포함하므로 GitHub이 422를 돌려줄 수 있다.
 *        호출 측에서 태그가 비었을 때 검색을 아예 건너뛰도록 분기해야 한다.
 *        `minStars`는 음수/NaN이면 무시된다. `sort`가 'best-match'이면 한정자를 추가하지 않는다.
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

  const minStars = options.minStars;
  if (typeof minStars === 'number' && Number.isFinite(minStars) && minStars > 0) {
    parts.push(`stars:>=${Math.floor(minStars)}`);
  }

  if (options.noAssignee) {
    parts.push('no:assignee');
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
