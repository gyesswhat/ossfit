import { FeedSkeleton } from './feed-skeleton';

/**
 * [목적] /(main) 라우트 그룹 진입·재검증 중 표시할 기본 로딩 화면.
 *        피드 카드 6개 분량의 스켈레톤만 보여주고 헤더/필터는 페이지 단에서 다시 그려진다.
 */
export default function MainLoading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <FeedSkeleton />
    </main>
  );
}
