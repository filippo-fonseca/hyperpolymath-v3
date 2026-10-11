"use client";

import type { ReactNode } from "react";
import { Button, fieldClass } from "@/components/ui/primitives";

export const textareaClass = `${fieldClass} h-auto min-h-[84px] w-full resize-none py-2.5 leading-snug`;
export const selectClass = `${fieldClass} w-full appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8`;

/** Chevron for native selects (they lose theirs with appearance-none). */
export const selectStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23959595' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
};

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-[12.5px] leading-snug text-ink-3">{hint}</span>}
    </label>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3 className="text-[13px] font-semibold text-gray-500">{children}</h3>
      {aside}
    </div>
  );
}

/** Inline "are you sure" card, as in the Activity revert confirmation. */
export function ConfirmCard({
  text,
  action,
  busy,
  onCancel,
  onConfirm,
}: {
  text: ReactNode;
  action: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-[16px] bg-gray-100 p-4">
      <p className="text-[14px] leading-snug text-ink-2">{text}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" variant="dark" onClick={onConfirm} disabled={busy}>
          {action}
        </Button>
      </div>
    </div>
  );
}
