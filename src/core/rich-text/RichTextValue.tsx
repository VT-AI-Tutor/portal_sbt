import { createElement, type ElementType, type ReactNode } from 'react';
import type { RichTextRun } from '@/core/question-schema';
import { richTextRunsToHtml } from '@/core/rich-text/html';
import { InlineMathText } from '@/core/math/InlineMathText';

export interface RichTextValueProps {
  value?: string | RichTextRun[] | null;
  className?: string;
  as?: ElementType;
  children?: ReactNode;
}

/** One safe display boundary for legacy inline HTML, canonical runs, and fractions. */
export function RichTextValue({ value, className, as = 'span', children }: RichTextValueProps) {
  const raw = Array.isArray(value)
    ? richTextRunsToHtml(value)
    : value ?? (typeof children === 'string' ? children : '');
  return createElement(as, { className }, <InlineMathText value={raw} />);
}
