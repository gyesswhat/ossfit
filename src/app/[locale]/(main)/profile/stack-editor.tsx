'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TagPicker } from '@/components/features/tag-picker';
import { updateStackAction, type UpdateStackState } from './actions';

const initialState: UpdateStackState = { status: 'idle' };

type Props = {
  locale: string;
  initialStackTags: string[];
  personalTopics: readonly string[];
};

/**
 * [목적] 프로필의 스택 태그 편집 UI. TagPicker로 카탈로그 기반 선택 후 "저장"으로 Server Action에 전송.
 * [주의] 선택값은 저장 시점에 hidden input으로 서버에 복제 전달한다.
 *        재분석 버튼이 별도로 존재하므로 여기서는 GitHub API를 호출하지 않는다.
 */
export function StackEditor({ locale, initialStackTags, personalTopics }: Props) {
  const t = useTranslations('Profile');
  const [stackTags, setStackTags] = useState<string[]>(initialStackTags);
  const [state, formAction, isPending] = useActionState(
    updateStackAction,
    initialState,
  );

  const message =
    state.status === 'success'
      ? t('stackSaveSuccess')
      : state.status === 'unauthenticated'
        ? t('reanalyzeUnauthenticated')
        : state.status === 'error'
          ? t('stackSaveError')
          : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {stackTags.map((tag) => (
        <input key={tag} type="hidden" name="stackTags" value={tag} />
      ))}

      <TagPicker
        selectedSlugs={stackTags}
        personalTopicSlugs={personalTopics}
        onChange={setStackTags}
      />

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
