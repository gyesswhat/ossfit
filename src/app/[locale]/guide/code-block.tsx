'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = {
  code: string;
  /** 복사 버튼에 표시되는 접근성 라벨. i18n 키 값을 상위에서 전달한다. */
  copyLabel: string;
  copiedLabel: string;
};

/**
 * [목적] 기여 가이드에서 사용하는 코드 블록. 우측 상단 복사 버튼과 "복사됨" 피드백을 포함한다.
 * [주의] navigator.clipboard가 거부당한 환경(권한 거부, HTTP)에서는 fallback textarea + execCommand를 쓴다.
 *        버튼 상태는 2초 후 자동 리셋한다.
 */
export function CodeBlock({ code, copyLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
    } catch {
      // 클립보드 실패는 사용자가 코드를 직접 드래그할 수 있으므로 조용히 무시한다.
    }
  }

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-6 text-foreground">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={copied ? copiedLabel : copyLabel}
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
