/**
 * [목적] 관심 도메인 옵션을 온보딩·마이페이지가 공유하도록 한 곳에 둔다.
 *        DB에는 이 slug들만 저장되고, i18n은 `Onboarding.domainLabels.<slug>`에서 가져온다.
 */
export const DOMAIN_OPTIONS = ['spring-boot', 'kotlin', 'devops', 'etc'] as const;
export type DomainOption = (typeof DOMAIN_OPTIONS)[number];

export const DOMAIN_SET: ReadonlySet<string> = new Set(DOMAIN_OPTIONS);
