"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, type MagicLinkState } from "@/app/actions/auth";
import { IconArrowRight, IconMail } from "@/components/ui/icons";

const ERRORS: Record<string, string> = {
  not_allowed: "That account can't sign in here.",
  link_invalid: "That sign-in link expired or was already used. Request a fresh one.",
};

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });
  const queryError = params.get("error");

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-center py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <IconMail size={22} />
        </div>
        <h2 className="mt-4 text-[17px] font-semibold">Check your inbox</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{state.message}</p>
      </div>
    );
  }

  const notice =
    state.status === "error"
      ? { text: state.message ?? "" }
      : queryError
        ? { text: ERRORS[queryError] ?? "Something went wrong. Try again." }
        : null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-[13px] font-medium text-ink-2">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        className="h-12 rounded-[14px] bg-gray-100 px-4 text-[15px] outline-none ring-1 ring-transparent transition placeholder:text-ink-3 focus:bg-white focus:ring-accent/40"
      />
      {notice && (
        <p
          role="status"
          className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13.5px] leading-snug text-[#c4182b]"
        >
          {notice.text}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-white transition hover:bg-gray-900 active:scale-[0.985] disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send magic link"}
        {!pending && <IconArrowRight size={16} />}
      </button>
    </form>
  );
}
