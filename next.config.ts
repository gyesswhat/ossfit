import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Next 16 Turbopack 기본값. 설정 옵션은 `turbopack` 키로 이동.
};

export default withNextIntl(nextConfig);
