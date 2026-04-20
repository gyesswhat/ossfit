import {
  LANGUAGE_CATALOG,
  TOPIC_CATALOG,
  type CatalogLanguage,
  type CatalogTopic,
} from './catalog.generated';

export type TagKind = 'language' | 'topic';

/**
 * [목적] 카탈로그를 소비하는 쪽에서 쓰는 도우미 모음.
 *        빌드 타임 생성 파일(`catalog.generated.ts`)은 수정하지 않고 여기서만 파생 구조를 만든다.
 */

const LANGUAGE_SLUGS: ReadonlySet<string> = new Set(
  LANGUAGE_CATALOG.map((entry) => entry.slug),
);

const TOPIC_SLUGS: ReadonlySet<string> = new Set(
  TOPIC_CATALOG.map((entry) => entry.name),
);

const LANGUAGE_BY_SLUG = new Map<string, CatalogLanguage>(
  LANGUAGE_CATALOG.map((entry) => [entry.slug, entry]),
);

const TOPIC_BY_NAME = new Map<string, CatalogTopic>(
  TOPIC_CATALOG.map((entry) => [entry.name, entry]),
);

/**
 * [목적] 자유 입력 혹은 외부 문자열을 슬러그 형태(소문자, 공백→하이픈)로 맞춘다.
 */
export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * [목적] 카탈로그 기준으로 유효한 토픽 슬러그인지 검사. 빈 문자열과 허용되지 않은 문자 제거.
 * [주의] GitHub 토픽 슬러그 규칙(영소문자/숫자/하이픈)만 허용. `#`, `+`, `.` 등은 Search 쿼리에서
 *        예상치 못한 422를 유발하므로 피커에서만 선택하도록 한다.
 */
const TOPIC_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/;
export function isValidTopicSlug(slug: string): boolean {
  return TOPIC_SLUG_PATTERN.test(slug);
}

/**
 * [목적] 주어진 슬러그가 카탈로그의 언어인지 확인.
 */
export function isKnownLanguage(slug: string): boolean {
  return LANGUAGE_SLUGS.has(slug);
}

/**
 * [목적] Featured Topics 카탈로그에 포함된 슬러그인지 확인.
 */
export function isKnownFeaturedTopic(slug: string): boolean {
  return TOPIC_SLUGS.has(slug);
}

/**
 * [목적] 슬러그를 GitHub Search 한정자(language: / topic:)로 매핑.
 *        카탈로그에 없는 언어 후보는 자동으로 topic으로 분류된다.
 * [주의] 토픽 슬러그가 규칙을 지키지 않으면 null을 반환해 호출 측이 버리도록 한다.
 */
export function classifyTag(slug: string): TagKind | null {
  if (LANGUAGE_SLUGS.has(slug)) return 'language';
  if (isValidTopicSlug(slug)) return 'topic';
  return null;
}

export function getLanguageBySlug(slug: string): CatalogLanguage | undefined {
  return LANGUAGE_BY_SLUG.get(slug);
}

export function getFeaturedTopic(name: string): CatalogTopic | undefined {
  return TOPIC_BY_NAME.get(name);
}

/**
 * [목적] 피커 UI에 표시할 "보조 표기" — 언어는 공식 대소문자, 토픽은 display_name.
 *        카탈로그에 없는 슬러그(예: 개인 토픽)는 슬러그를 그대로 반환.
 */
export function displayNameForSlug(slug: string): string {
  const language = LANGUAGE_BY_SLUG.get(slug);
  if (language) return language.name;
  const topic = TOPIC_BY_NAME.get(slug);
  if (topic) return topic.displayName;
  return slug;
}

export { LANGUAGE_CATALOG, TOPIC_CATALOG };
export type { CatalogLanguage, CatalogTopic };
