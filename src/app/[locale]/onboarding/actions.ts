'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { updateUserProfile } from '@/lib/profile/service';

const MAX_STACK_TAG_LENGTH = 40;
const MAX_STACK_TAGS = 20;
const MAX_DOMAINS = 10;

/**
 * [목적] 온보딩 제출 처리. stack_tags / domains 저장 + onboarding_completed = true 후 홈으로 이동.
 * [주의] FormData에는 각 배열 필드가 반복 필드로 담겨 있다. 상한을 둬 악성 입력을 차단한다.
 *        redirect는 Next의 Server Action 내부에서 throw 방식으로 동작한다.
 */
export async function completeOnboarding(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const stackTagsRaw = formData.getAll('stackTags').map((value) => value.toString());
  const domainsRaw = formData.getAll('domains').map((value) => value.toString());

  const stackTags = Array.from(
    new Set(
      stackTagsRaw
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length <= MAX_STACK_TAG_LENGTH),
    ),
  ).slice(0, MAX_STACK_TAGS);

  const domains = Array.from(
    new Set(domainsRaw.map((domain) => domain.trim()).filter((domain) => domain.length > 0)),
  ).slice(0, MAX_DOMAINS);

  await updateUserProfile(session.user.id, {
    stackTags,
    domains,
    onboardingCompleted: true,
  });

  revalidatePath(`/${locale}`);
  redirect(`/${locale}`);
}
