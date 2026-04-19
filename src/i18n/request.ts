import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * [목적] 서버 컴포넌트가 번역 메시지를 로드할 때 호출되는 설정 함수.
 * [주의] 요청된 locale이 지원 목록에 없으면 기본 locale로 폴백한다.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
