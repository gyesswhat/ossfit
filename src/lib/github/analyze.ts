import { graphql } from '@octokit/graphql';

/**
 * [목적] 사용자 OAuth 토큰으로 GitHub GraphQL을 호출해 언어별 바이트와 merged PR 수를 수집한다.
 * [주의] 상위 10개 레포(푸시 최신순)의 언어 분포만 샘플링한다. 전체 레포 집계는 쿼터가 커 피한다.
 *        `MERGED` 필터를 totalCount와 함께 사용해 추가 페이지네이션 없이 합계만 얻는다.
 */

export type GitHubLanguageBytes = { name: string; bytes: number };

export type GitHubActivity = {
  languages: GitHubLanguageBytes[];
  mergedPullRequestCount: number;
};

type ActivityQueryResponse = {
  viewer: {
    repositories: {
      nodes: Array<{
        languages: {
          edges: Array<{ size: number; node: { name: string } }> | null;
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
  for (const repo of response.viewer.repositories.nodes ?? []) {
    for (const edge of repo?.languages?.edges ?? []) {
      const name = edge?.node?.name;
      const size = edge?.size ?? 0;
      if (!name) continue;
      byteMap.set(name, (byteMap.get(name) ?? 0) + size);
    }
  }

  const languages: GitHubLanguageBytes[] = [...byteMap.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    languages,
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
 * [목적] 언어를 GitHub Search 쿼리에서 그대로 사용 가능한 태그로 정규화.
 * [주의] GitHub `language:` 한정자는 공식 표기를 요구한다. 여기서는 소문자 + 공백 제거로 근사치를 만든다.
 *        `C++` → `c++`, `C#` → `c#` 등 연산자 문자는 그대로 둔다 (UNIT-07 쿼리 빌더에서 따옴표 처리).
 */
export function normalizeLanguageTag(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * [목적] 언어 바이트 분포에서 점유율 5% 이상인 언어를 최대 8개까지 스택 태그로 추출.
 * [주의] 합계 바이트가 0이면 빈 배열을 반환한다.
 */
export function deriveStackTags(languages: GitHubLanguageBytes[]): string[] {
  const totalBytes = languages.reduce((sum, lang) => sum + lang.bytes, 0);
  if (totalBytes <= 0) return [];

  return languages
    .filter((lang) => lang.bytes / totalBytes >= STACK_TAG_MIN_SHARE)
    .slice(0, STACK_TAG_MAX)
    .map((lang) => normalizeLanguageTag(lang.name));
}

export type DerivedSkillProfile = {
  stackTags: string[];
  level: SkillLevel;
};

/**
 * [목적] GitHub 활동 원자료를 저장 가능한 프로필 필드로 변환.
 */
export function deriveSkillProfile(activity: GitHubActivity): DerivedSkillProfile {
  return {
    stackTags: deriveStackTags(activity.languages),
    level: deriveLevel(activity.mergedPullRequestCount),
  };
}
