import { graphql, GraphqlResponseError } from '@octokit/graphql';

/**
 * [목적] 사용자 스택/도메인 태그를 GitHub Search 한정자 문자열로 변환하고
 *        Search API(GraphQL)를 호출해 이슈 목록을 받아온다.
 * [참고] https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests
 */

/**
 * GitHub `language:` 한정자가 인식하는 언어 이름 집합 (소문자 정규화 기준).
 * 새 항목이 늘어나도 코드 변경 없이 추가만 하면 된다.
 * 여기 포함되지 않은 태그는 모두 `topic:` 한정자로 취급한다.
 */
const KNOWN_LANGUAGES: ReadonlySet<string> = new Set([
  'java',
  'kotlin',
  'python',
  'typescript',
  'javascript',
  'go',
  'rust',
  'ruby',
  'php',
  'c',
  'c++',
  'c#',
  'swift',
  'scala',
  'elixir',
  'haskell',
  'dart',
  'objective-c',
  'shell',
  'bash',
  'lua',
  'clojure',
  'r',
  'perl',
  'html',
  'css',
  'sass',
  'scss',
  'vue',
  'svelte',
  'zig',
  'nim',
  'erlang',
  'ocaml',
  'fsharp',
  'groovy',
  'powershell',
  'sql',
]);

/**
 * 추천 라벨 화이트리스트. 외부 입력을 그대로 쿼리에 넣지 않도록 사전 검증할 때 사용한다.
 */
export const RECOMMENDED_LABELS = ['good first issue', 'help wanted'] as const;
export type RecommendedLabel = (typeof RECOMMENDED_LABELS)[number];

/**
 * [목적] 공백·특수문자를 포함한 값을 GitHub Search 한정자에 안전하게 끼워넣는다.
 *        예) `language:c++` → `language:"c++"`, `topic:spring boot` → `topic:"spring boot"`
 */
function quoteIfNeeded(value: string): string {
  return /[\s+#"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/**
 * [목적] 스택 태그 + 라벨 → GitHub Search 쿼리 문자열.
 *        언어로 인식되는 태그는 `language:`, 그 외는 `topic:`로 매핑한다.
 *        결과 예: `language:java topic:spring-boot label:"good first issue" type:issue state:open archived:false`
 * [주의] 태그/라벨은 호출 측에서 trim·소문자화된 값을 전달한다고 가정하지만,
 *        방어적으로 한 번 더 정규화한다. 빈 문자열은 무시한다.
 */
export function buildSearchQuery(
  tags: readonly string[],
  labels: readonly string[] = [],
): string {
  const parts: string[] = [];

  for (const rawTag of tags) {
    const tag = rawTag.trim().toLowerCase();
    if (!tag) continue;
    if (KNOWN_LANGUAGES.has(tag)) {
      parts.push(`language:${quoteIfNeeded(tag)}`);
    } else {
      parts.push(`topic:${quoteIfNeeded(tag)}`);
    }
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
  query OssfitSearchIssues($query: String!, $first: Int!) {
    search(query: $query, type: ISSUE, first: $first) {
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
    query,
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
