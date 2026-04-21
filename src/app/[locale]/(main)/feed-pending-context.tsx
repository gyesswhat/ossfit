'use client';

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from 'react';

/**
 * [목적] 필터/페이지네이션 변경 시 발생하는 React useTransition 상태를 피드 영역과 공유하기 위한 컨텍스트.
 *        같은 트리 안에서 여러 client 컴포넌트가 한 startTransition을 공유해야 isPending이 일관되게 흐른다.
 * [주의] 이 Provider 외부에서 useFeedPending을 호출하면 isPending=false, startTransition은 즉시 실행 폴백으로 동작한다.
 */

type FeedPendingContextValue = {
  isPending: boolean;
  startTransition: TransitionStartFunction;
};

const FeedPendingContext = createContext<FeedPendingContextValue>({
  isPending: false,
  startTransition: (callback) => {
    callback();
  },
});

export function FeedPendingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <FeedPendingContext.Provider value={{ isPending, startTransition }}>
      {children}
    </FeedPendingContext.Provider>
  );
}

export function useFeedPending(): FeedPendingContextValue {
  return useContext(FeedPendingContext);
}
