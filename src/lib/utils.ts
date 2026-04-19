import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn 표준 유틸: Tailwind 클래스 충돌 머지. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
