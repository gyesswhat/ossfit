'use client';

import { useState } from 'react';
import type { RepoResult } from '@/lib/github/search';
import { RepoCard } from './repo-card';
import { RepoDetailModal } from './repo-detail-modal';

type Props = {
  locale: string;
  repos: RepoResult[];
  initialBookmarkedUrls: string[];
};

/**
 * [목적] 레포 카드 리스트 + 상세 모달 컨테이너. 선택 상태와 북마크 Set을 클라이언트에서 관리한다.
 * [주의] 서버에서 받은 초기 북마크 집합은 Set으로 변환해 카드 렌더링 시 O(1)로 조회한다.
 */
export function RepoFeed({ locale, repos, initialBookmarkedUrls }: Props) {
  const [selected, setSelected] = useState<RepoResult | null>(null);
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(
    () => new Set(initialBookmarkedUrls),
  );

  function handleBookmarkChange(repoUrl: string, bookmarked: boolean) {
    setBookmarkedUrls((prev) => {
      const next = new Set(prev);
      if (bookmarked) next.add(repoUrl);
      else next.delete(repoUrl);
      return next;
    });
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {repos.map((repo) => (
          <RepoCard
            key={repo.id}
            repo={repo}
            bookmarked={bookmarkedUrls.has(repo.url)}
            onOpen={setSelected}
          />
        ))}
      </ul>
      <RepoDetailModal
        locale={locale}
        repo={selected}
        initialBookmarked={selected ? bookmarkedUrls.has(selected.url) : false}
        onClose={() => setSelected(null)}
        onBookmarkChange={handleBookmarkChange}
      />
    </>
  );
}
