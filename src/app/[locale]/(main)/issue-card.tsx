import { Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { IssueResult } from '@/lib/github/search';

/**
 * [목적] 피드의 단일 이슈 카드. 레포명, 제목, 라벨, 언어, 별 수, 생성일을 표시한다.
 * [주의] 외부 링크로 새 탭 이동. 이슈 상세 패널은 UNIT-08에서 추가된다.
 *        라벨 색상은 GitHub이 보장하는 6자리 hex이지만 모델 무결성 보장이 없으므로
 *        잘못된 값이 와도 readable text 색이 깨지지 않게 안전한 폴백을 둔다.
 */
export function IssueCard({ issue }: { issue: IssueResult }) {
  const t = useTranslations('Feed');
  const format = useFormatter();
  const created = new Date(issue.createdAt);

  return (
    <li className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate font-medium">{issue.repository.nameWithOwner}</span>
        <span className="flex items-center gap-1">
          <Star className="size-3" aria-hidden />
          {format.number(issue.repository.stargazerCount)}
        </span>
      </div>
      <a
        href={issue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-2 text-base font-semibold text-foreground hover:text-primary"
      >
        {issue.title}
      </a>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {issue.repository.primaryLanguage && (
          <Badge variant="outline" className="border-border text-muted-foreground">
            {issue.repository.primaryLanguage}
          </Badge>
        )}
        {issue.labels.slice(0, 4).map((label) => (
          <span
            key={label.name}
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={labelStyle(label.color)}
          >
            {label.name}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('createdAt', { date: format.dateTime(created, 'short') })}
      </p>
    </li>
  );
}

/**
 * GitHub label.color는 `#` 없는 6자리 hex. 잘못된 값에는 중립 회색을 적용한다.
 * 텍스트 가독성을 위해 hex 휘도를 계산해 글자색을 흑/백으로 결정한다.
 */
function labelStyle(color: string): React.CSSProperties {
  const safe = /^[0-9a-fA-F]{6}$/.test(color) ? color : 'e5e7eb';
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    backgroundColor: `#${safe}`,
    color: luminance > 0.6 ? '#171717' : '#ffffff',
  };
}
