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
 * [목적] 공백을 포함하거나 따옴표가 필요한 라벨 값을 한정자에 안전하게 끼워넣는다.
 *        예) `label:"good first issue"`. 토픽/언어는 이미 슬러그로 정규화되므로 일반적으로 불필요하다.
 */
function quoteIfNeeded(value: string): string {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/**
 * [목적] 카탈로그 기반 스택 태그 + 라벨 → GitHub Search 쿼리 문자열.
 *        카탈로그가 언어로 식별한 슬러그는 `language:`, 그 외 유효 토픽 슬러그는 `topic:`.
 *        카탈로그에 없고 토픽 슬러그 규칙도 깨진 값은 조용히 버린다 — 예: `#devops`, `react native`.
 * [주의] 태그가 0개면 반환 문자열은 필수 한정자만 포함하므로 GitHub이 422를 돌려줄 수 있다.
 *        호출 측에서 태그가 비었을 때 검색을 아예 건너뛰도록 분기해야 한다.
 */
export function buildSearchQuery(
  tags: readonly string[],
  labels: readonly string[] = [],
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

  parts.push('type:issue', 'state:open', 'archived:false');
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
    nodes: Array<GraphQLSearchNode | null> | null;
  };
};

const SEARCH_QUERY = /* GraphQL */ `
  query OssfitSearchIssues($searchQuery: String!, $first: Int!) {
    search(query: $searchQuery, type: ISSUE, first: $first) {
      issueCount
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

const DEFAULT_LIMIT = 30;

/**
 * [목적] 빌더로 만든 쿼리를 GitHub Search GraphQL 엔드포인트에 보낸다.
 * [주의] 사용자 OAuth 토큰을 사용해야 검색 한도가 계정별로 분리된다.
 *        Issue/PullRequest 유니온 노드 중 Issue만 골라낸다.
 */
export async function searchIssues(
  query: string,
  accessToken: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SearchIssuesResult> {
  const client = graphql.defaults({
    headers: { authorization: `bearer ${accessToken}` },
  });

  const response = await client<GraphQLSearchResponse>(SEARCH_QUERY, {
    searchQuery: query,
    first: Math.min(Math.max(limit, 1), 50),
  });

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

  return { issueCount: response.search.issueCount, issues };
}
