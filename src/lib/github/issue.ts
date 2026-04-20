import { graphql } from '@octokit/graphql';

/**
 * [목적] 단일 이슈의 본문(HTML 렌더링된 GitHub Flavored Markdown)을 GraphQL로 조회한다.
 * [주의] `bodyHTML`은 GitHub이 이미 sanitize한 HTML이므로 `dangerouslySetInnerHTML`로 렌더해도 안전하다.
 *        본문 길이에 따라 응답이 커질 수 있어 목록 단계에서는 호출하지 않고 상세 패널 열릴 때만 호출한다.
 */

export type IssueDetail = {
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | string;
  author: { login: string; avatarUrl: string } | null;
  bodyHTML: string;
  createdAt: string;
  comments: number;
  repository: {
    nameWithOwner: string;
    owner: string;
    name: string;
  };
};

type IssueQueryResponse = {
  repository: {
    nameWithOwner: string;
    owner: { login: string };
    name: string;
    issue: {
      number: number;
      title: string;
      url: string;
      state: string;
      createdAt: string;
      bodyHTML: string;
      comments: { totalCount: number };
      author: { login: string; avatarUrl: string } | null;
    } | null;
  } | null;
};

const ISSUE_QUERY = /* GraphQL */ `
  query OssfitIssueDetail($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      nameWithOwner
      owner {
        login
      }
      name
      issue(number: $number) {
        number
        title
        url
        state
        createdAt
        bodyHTML
        comments {
          totalCount
        }
        author {
          login
          avatarUrl
        }
      }
    }
  }
`;

/**
 * [목적] 사용자 OAuth 토큰으로 이슈 상세를 조회.
 * [주의] 이슈가 존재하지 않거나 비공개 레포면 null을 반환한다 (GraphQL은 404 대신 null을 돌려준다).
 */
export async function fetchIssueDetail(
  accessToken: string,
  owner: string,
  name: string,
  number: number,
): Promise<IssueDetail | null> {
  const client = graphql.defaults({
    headers: { authorization: `bearer ${accessToken}` },
  });

  const response = await client<IssueQueryResponse>(ISSUE_QUERY, {
    owner,
    name,
    number,
  });

  const repo = response.repository;
  const issue = repo?.issue;
  if (!repo || !issue) return null;

  return {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    createdAt: issue.createdAt,
    bodyHTML: issue.bodyHTML,
    comments: issue.comments.totalCount,
    author: issue.author
      ? { login: issue.author.login, avatarUrl: issue.author.avatarUrl }
      : null,
    repository: {
      nameWithOwner: repo.nameWithOwner,
      owner: repo.owner.login,
      name: repo.name,
    },
  };
}

/**
 * [목적] `owner/repo` 형식 식별자를 분리. 잘못된 형식이면 null을 반환한다.
 */
export function parseRepoFullName(
  value: string,
): { owner: string; name: string } | null {
  const match = value.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) return null;
  return { owner: match[1]!, name: match[2]! };
}
