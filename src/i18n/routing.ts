import { defineRouting } from 'next-intl/routing';

/**
 * [목적] next-intl 라우팅 설정. 지원 로케일과 기본 로케일 정의.
 * [주의] `locales`를 늘릴 경우 `messages/` 폴더에 번역 파일도 함께 추가해야 한다.
 */
export const routing = defineRouting({
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
});

export type Locale = (typeof routing.locales)[number];
