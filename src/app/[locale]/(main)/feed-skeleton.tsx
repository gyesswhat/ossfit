import { Skeleton } from '@/components/ui/skeleton';

/**
 * [목적] 피드 로딩 중 표시할 카드 자리표시자.
 *        Suspense boundary와 페이지 전환 시 loading.tsx에서 모두 재사용한다.
 */
export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
