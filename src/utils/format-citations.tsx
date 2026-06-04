"use client";

import { Fragment } from "react";

/** Bold rulebook source tags and page references in citation text. */
const CITATION_PATTERN = /(\[Source:[^\]]+\]|(?:Page|page)\s+\d+(?:\s*[-–]\s*\d+)?|\*\*[^*]+\*\*)/g;

export function FormattedCitationText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(CITATION_PATTERN).filter((p) => p.length > 0);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const isBold =
          part.startsWith("[Source:") ||
          /^Page\s+\d+/i.test(part) ||
          (part.startsWith("**") && part.endsWith("**"));

        const content =
          part.startsWith("**") && part.endsWith("**")
            ? part.slice(2, -2)
            : part;

        return isBold ? (
          <strong key={i} className="font-semibold text-slate-800">
            {content}
          </strong>
        ) : (
          <Fragment key={i}>{content}</Fragment>
        );
      })}
    </span>
  );
}
