import { Skeleton } from '@/components/ui/skeleton';
import { FeedSkeleton } from './feed-skeleton';

/**
 * [목적] /(main) 라우트 그룹 진입·재검증 중 표시할 로딩 화면.
 *        헤더(인사·레벨·스택 배지) + 검색 기준 카드 + 필터 패널 + 8장 레포 카드 그리드 뼈대를
 *        렌더해 서버 RSC가 도착할 때까지 화면이 비지 않도록 한다.
 * [주의] 실제 page.tsx와 동일한 메인 래퍼 클래스를 사용해 hydration 시 layout shift를 0으로 둔다.
 */
export default function MainLoading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <HeaderSkeleton />
      <CriteriaSkeleton />
      <FiltersSkeleton />
      <section className="flex flex-col gap-3" aria-busy="true">
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <FeedSkeleton count={8} />
      </section>
    </main>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

function CriteriaSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className="h-7 w-16 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
