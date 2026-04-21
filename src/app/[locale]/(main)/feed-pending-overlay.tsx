'use client';

import type { ReactNode } from 'react';
import { useFeedPending } from './feed-pending-context';

/**
 * [목적] 필터/페이지네이션 전환 중에는 기존 카드 그리드를 dim + non-interactive 처리한다.
 *        Suspense boundary가 fallback으로 교체되지 않고도 "처리 중"임을 시각적으로 알리는 stale-while-loading.
 * [주의] aria-busy를 함께 켜 스크린리더에도 처리 중임을 알린다.
 */
export function FeedPendingArea({ children }: { children: ReactNode }) {
  const { isPending } = useFeedPending();
  return (
    <div
      aria-busy={isPending}
      className={
        isPending
          ? 'pointer-events-none opacity-60 transition-opacity duration-150'
          : 'transition-opacity duration-150'
      }
    >
      {children}
    </div>
  );
}

/**
 * [목적] 화면 상단에 가는 핑크색 진행 바를 표시해 전환이 진행 중임을 알린다.
 *        isPending false 일 때는 DOM에서 빠져 layout shift 0.
 */
export function FeedPendingProgress() {
  const { isPending } = useFeedPending();
  if (!isPending) return null;
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label="loading"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div className="h-full w-1/3 animate-[feedPendingSlide_1.2s_ease-in-out_infinite] bg-primary" />
      <style>{`@keyframes feedPendingSlide{0%{margin-left:-33%}50%{margin-left:50%}100%{margin-left:120%}}`}</style>
    </div>
  );
}
