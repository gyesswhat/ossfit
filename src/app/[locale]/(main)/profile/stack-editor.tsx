'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { updateStackAction, type UpdateStackState } from './actions';

const initialState: UpdateStackState = { status: 'idle' };

type Props = {
  locale: string;
  initialStackTags: string[];
};

/**
 * [목적] 프로필의 스택 태그 편집 UI. 추가/제거 후 "저장" 버튼으로 Server Action에 전송한다.
 * [주의] 상태는 클라이언트에서 관리하고, 저장 순간에만 hidden input으로 서버에 복제 전달한다.
 *        재분석 버튼이 별도로 존재하므로 여기서는 GitHub API를 호출하지 않는다.
 */
export function StackEditor({ locale, initialStackTags }: Props) {
  const t = useTranslations('Profile');
  const [stackTags, setStackTags] = useState<string[]>(initialStackTags);
  const [newTag, setNewTag] = useState('');
  const [state, formAction, isPending] = useActionState(
    updateStackAction,
    initialState,
  );

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    setStackTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setNewTag('');
  }

  function removeTag(tag: string) {
    setStackTags((prev) => prev.filter((value) => value !== tag));
  }

  const message =
    state.status === 'success'
      ? t('stackSaveSuccess')
      : state.status === 'unauthenticated'
        ? t('reanalyzeUnauthenticated')
        : state.status === 'error'
          ? t('stackSaveError')
          : null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {stackTags.map((tag) => (
        <input key={tag} type="hidden" name="stackTags" value={tag} />
      ))}

      <div className="flex min-h-10 flex-wrap gap-2">
        {stackTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('stackEmpty')}</p>
        ) : (
          stackTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              aria-label={t('removeTag', { tag })}
            >
              {tag} ×
            </button>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTag(newTag);
            }
          }}
          placeholder={t('stackPlaceholder')}
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <Button type="button" variant="outline" onClick={() => addTag(newTag)}>
          {t('addTag')}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        {message ? (
          <p
            role="status"
            className={
              state.status === 'success'
                ? 'text-xs text-muted-foreground'
                : 'text-xs text-destructive'
            }
          >
            {message}
          </p>
        ) : (
          <span aria-hidden />
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? t('stackSaving') : t('stackSave')}
        </Button>
      </div>
    </form>
  );
}
