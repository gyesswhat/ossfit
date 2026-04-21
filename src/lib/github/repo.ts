import { graphql } from '@octokit/graphql';

/**
 * [목적] 단일 레포의 상세(설명/라이선스/토픽/별/last push)와 기여 후보 이슈 목록을 한 번에 조회.
 *        피드에서 레포 카드를 클릭했을 때 상세 모달에 노출하는 데이터가 여기에서 만들어진다.
 * [참고] https://docs.github.com/en/graphql/reference/objects#repository
 */

export type RepoIssueSummary = {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  commentCount: number;
  labels: Array<{ name: string; color: string }>;
};

export type RepoDetail = {
  nameWithOwner: string;
  owner: string;
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  license: string | null;
  licenseName: string | null;
  pushedAt: string;
  createdAt: string;
  stargazerCount: number;
  forkCount: number;
  watcherCount: number;
  openIssueCount: number;
  primaryLanguage: string | null;
  topics: string[];
  goodFirstIssues: RepoIssueSummary[];
  helpWantedIssues: RepoIssueSummary[];
};

type GraphQLIssueNode = {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  comments: { totalCount: number };
  labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
};

type GraphQLRepoDetailResponse = {
  repository: {
    nameWithOwner: string;
    name: string;
    url: string;
    homepageUrl: string | null;
    description: string | null;
    pushedAt: string | null;
    createdAt: string;
    stargazerCount: number;
    forkCount: number;
    watchers: { totalCount: number };
    owner: { login: string };
    licenseInfo: {
      key: string | null;
      spdxId: string | null;
      name: string | null;
    } | null;
    primaryLanguage: { name: string } | null;
    repositoryTopics: {
      nodes: Array<{ topic: { name: string } } | null> | null;
    } | null;
    openIssues: { totalCount: number };
    goodFirstIssues: { nodes: Array<GraphQLIssueNode | null> | null };
    helpWantedIssues: { nodes: Array<GraphQLIssueNode | null> | null };
  } | null;
};

const REPO_DETAIL_QUERY = /* GraphQL */ `
  query OssfitRepoDetail($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      nameWithOwner
      name
      url
      homepageUrl
      description
      pushedAt
      createdAt
      stargazerCount
      forkCount
      watchers {
        totalCount
      }
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
      repositoryTopics(first: 12) {
        nodes {
          topic {
            name
          }
        }
      }
      openIssues: issues(states: OPEN) {
        totalCount
      }
      goodFirstIssues: issues(
        states: OPEN
        first: 5
        orderBy: { field: UPDATED_AT, direction: DESC }
        filterBy: { labels: ["good first issue"] }
      ) {
        nodes {
          number
          title
          url
          createdAt
          comments {
            totalCount
          }
          labels(first: 6) {
            nodes {
              name
              color
            }
          }
        }
      }
      helpWantedIssues: issues(
        states: OPEN
        first: 5
        orderBy: { field: UPDATED_AT, direction: DESC }
        filterBy: { labels: ["help wanted"] }
      ) {
        nodes {
          number
          title
          url
          createdAt
          comments {
            totalCount
          }
          labels(first: 6) {
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
 * [목적] 사용자 OAuth 토큰으로 레포 상세 + 기여 후보 이슈(good first issue / help wanted) 상위 5개씩을 조회.
 * [주의] 레포가 존재하지 않거나 비공개면 null을 반환한다.
 */
export async function fetchRepoDetail(
  accessToken: string,
  owner: string,
  name: string,
): Promise<RepoDetail | null> {
  const client = graphql.defaults({
    headers: { authorization: `bearer ${accessToken}` },
  });

  const response = await client<GraphQLRepoDetailResponse>(REPO_DETAIL_QUERY, {
    owner,
    name,
  });

  const repo = response.repository;
  if (!repo) return null;

  const topics = (repo.repositoryTopics?.nodes ?? [])
    .filter(
      (entry): entry is { topic: { name: string } } => Boolean(entry?.topic?.name),
    )
    .map((entry) => entry.topic.name);

  const license =
    repo.licenseInfo?.spdxId ?? repo.licenseInfo?.key ?? repo.licenseInfo?.name ?? null;

  return {
    nameWithOwner: repo.nameWithOwner,
    owner: repo.owner.login,
    name: repo.name,
    description: repo.description,
    url: repo.url,
    homepageUrl: repo.homepageUrl,
    license,
    licenseName: repo.licenseInfo?.name ?? null,
    pushedAt: repo.pushedAt ?? repo.createdAt,
    createdAt: repo.createdAt,
    stargazerCount: repo.stargazerCount,
    forkCount: repo.forkCount,
    watcherCount: repo.watchers.totalCount,
    openIssueCount: repo.openIssues.totalCount,
    primaryLanguage: repo.primaryLanguage?.name ?? null,
    topics,
    goodFirstIssues: mapIssues(repo.goodFirstIssues.nodes),
    helpWantedIssues: mapIssues(repo.helpWantedIssues.nodes),
  };
}

function mapIssues(
  nodes: Array<GraphQLIssueNode | null> | null,
): RepoIssueSummary[] {
  return (nodes ?? [])
    .filter((node): node is GraphQLIssueNode => Boolean(node))
    .map((node) => ({
      number: node.number,
      title: node.title,
      url: node.url,
      createdAt: node.createdAt,
      commentCount: node.comments.totalCount,
      labels: (node.labels?.nodes ?? [])
        .filter(
          (label): label is { name: string; color: string } => label !== null,
        )
        .map((label) => ({ name: label.name, color: label.color })),
    }));
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
