import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * [목적] next-intl의 locale-aware 네비게이션 유틸. `<Link>`, `useRouter`, `redirect` 등을 래핑해 locale 프리픽스를 자동 처리.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
