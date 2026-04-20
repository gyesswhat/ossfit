'use client';

import { useState } from 'react';
import type { IssueResult } from '@/lib/github/search';
import { IssueCard } from './issue-card';
import { IssueDetailModal } from './issue-detail-modal';

type Props = {
  locale: string;
  issues: IssueResult[];
  initialBookmarkedUrls: string[];
};

/**
 * [목적] 이슈 카드 리스트 + 상세 모달의 컨테이너. 선택 상태와 북마크 Set을 클라이언트에서 관리한다.
 * [주의] 서버에서 받은 초기 북마크 집합은 Set으로 변환해 카드 렌더링 시 O(1)로 조회한다.
 *        모달에서 토글이 발생하면 낙관적으로 Set을 갱신하고 Server Action이 revalidatePath로 서버 상태도 맞춘다.
 */
export function IssueFeed({ locale, issues, initialBookmarkedUrls }: Props) {
  const [selected, setSelected] = useState<IssueResult | null>(null);
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(
    () => new Set(initialBookmarkedUrls),
  );

  function handleBookmarkChange(issueUrl: string, bookmarked: boolean) {
    setBookmarkedUrls((prev) => {
      const next = new Set(prev);
      if (bookmarked) next.add(issueUrl);
      else next.delete(issueUrl);
      return next;
    });
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            bookmarked={bookmarkedUrls.has(issue.url)}
            onOpen={setSelected}
          />
        ))}
      </ul>
      <IssueDetailModal
        locale={locale}
        issue={selected}
        initialBookmarked={selected ? bookmarkedUrls.has(selected.url) : false}
        onClose={() => setSelected(null)}
        onBookmarkChange={handleBookmarkChange}
      />
    </>
  );
}
