import { graphql } from '@octokit/graphql';
import { isKnownLanguage, isValidTopicSlug, normalizeSlug } from './catalog';

/**
 * [목적] 사용자 OAuth 토큰으로 GitHub GraphQL을 호출해 언어별 바이트, 개인 토픽, merged PR 수를 수집한다.
 * [주의] 상위 10개 레포(푸시 최신순)의 언어·토픽 분포만 샘플링한다. 전체 레포 집계는 쿼터가 커 피한다.
 *        `MERGED` 필터를 totalCount와 함께 사용해 추가 페이지네이션 없이 합계만 얻는다.
 */

export type GitHubLanguageBytes = { name: string; bytes: number };

export type GitHubActivity = {
  languages: GitHubLanguageBytes[];
  personalTopics: string[];
  mergedPullRequestCount: number;
};

type ActivityQueryResponse = {
  viewer: {
    repositories: {
      nodes: Array<{
        languages: {
          edges: Array<{ size: number; node: { name: string } }> | null;
        } | null;
        repositoryTopics: {
          nodes: Array<{ topic: { name: string } | null } | null> | null;
        } | null;
      } | null> | null;
    };
    pullRequests: { totalCount: number };
  };
};

const ACTIVITY_QUERY = /* GraphQL */ `
  query OssfitViewerActivity {
    viewer {
      repositories(
        first: 10
        orderBy: { field: PUSHED_AT, direction: DESC }
        ownerAffiliations: OWNER
        privacy: PUBLIC
        isFork: false
      ) {
        nodes {
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
              }
            }
          }
          repositoryTopics(first: 20) {
            nodes {
              topic {
                name
              }
            }
          }
        }
      }
      pullRequests(first: 1, states: [MERGED]) {
        totalCount
      }
    }
  }
`;

/**
 * [목적] GitHub GraphQL v4 엔드포인트를 호출해 활동 원자료를 반환.
 * [주의] 호출은 사용자 토큰 기반이라 rate limit이 계정별로 관리된다.
 */
export async function fetchGitHubActivity(
  accessToken: string,
): Promise<GitHubActivity> {
  const client = graphql.defaults({
    headers: { authorization: `bearer ${accessToken}` },
  });

  const response = await client<ActivityQueryResponse>(ACTIVITY_QUERY);

  const byteMap = new Map<string, number>();
  const topicSet = new Set<string>();
  for (const repo of response.viewer.repositories.nodes ?? []) {
    for (const edge of repo?.languages?.edges ?? []) {
      const name = edge?.node?.name;
      const size = edge?.size ?? 0;
      if (!name) continue;
      byteMap.set(name, (byteMap.get(name) ?? 0) + size);
    }
    for (const entry of repo?.repositoryTopics?.nodes ?? []) {
      const name = entry?.topic?.name;
      if (!name) continue;
      const slug = normalizeSlug(name);
      if (!slug || !isValidTopicSlug(slug)) continue;
      topicSet.add(slug);
    }
  }

  const languages: GitHubLanguageBytes[] = [...byteMap.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    languages,
    personalTopics: [...topicSet].sort(),
    mergedPullRequestCount: response.viewer.pullRequests.totalCount,
  };
}

export type SkillLevel = '입문' | '초급' | '중급';

/**
 * [목적] merged PR 수에 따라 레벨 라벨을 반환. 0: 입문, 1–10: 초급, 11+: 중급.
 */
export function deriveLevel(mergedPullRequestCount: number): SkillLevel {
  if (mergedPullRequestCount <= 0) return '입문';
  if (mergedPullRequestCount <= 10) return '초급';
  return '중급';
}

const STACK_TAG_MIN_SHARE = 0.05;
const STACK_TAG_MAX = 8;

/**
 * [목적] Linguist 언어명(예: "C++")을 카탈로그 슬러그(예: "c++")로 정규화.
 * [주의] 카탈로그가 인식하지 않는 언어(예: 마크업 전용)는 그대로 반환돼 호출 측에서 걸러진다.
 */
export function normalizeLanguageTag(name: string): string {
  return normalizeSlug(name);
}

/**
 * [목적] 언어 바이트 분포에서 점유율 5% 이상인 카탈로그 등록 언어를 최대 8개까지 추출.
 * [주의] 카탈로그에 없는 언어는 버려 "저장된 태그 = 검색에 쓰이는 태그"를 보장한다.
 *        합계 바이트가 0이면 빈 배열을 반환.
 */
export function deriveStackTags(languages: GitHubLanguageBytes[]): string[] {
  const totalBytes = languages.reduce((sum, lang) => sum + lang.bytes, 0);
  if (totalBytes <= 0) return [];

  return languages
    .filter((lang) => lang.bytes / totalBytes >= STACK_TAG_MIN_SHARE)
    .map((lang) => normalizeLanguageTag(lang.name))
    .filter((slug) => isKnownLanguage(slug))
    .slice(0, STACK_TAG_MAX);
}

export type DerivedSkillProfile = {
  stackTags: string[];
  level: SkillLevel;
  personalTopics: string[];
};

/**
 * [목적] GitHub 활동 원자료를 저장 가능한 프로필 필드로 변환.
 */
export function deriveSkillProfile(activity: GitHubActivity): DerivedSkillProfile {
  return {
    stackTags: deriveStackTags(activity.languages),
    level: deriveLevel(activity.mergedPullRequestCount),
    personalTopics: activity.personalTopics,
  };
}
