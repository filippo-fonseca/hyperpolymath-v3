"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { updatePassword, type PasswordState } from "@/app/actions/auth";
import { PASSWORD_MIN, passwordProblem } from "@/lib/auth-errors";
import { IconArrowRight } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { KiwiWithKey } from "@/components/illustrations";

async function submit(prev: PasswordState, form: FormData): Promise<PasswordState> {
  const problem = passwordProblem(String(form.get("password") ?? ""));
  if (problem) return { status: "error", field: "password", message: problem };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "error", message: "You're offline. Reconnect, then try again." };
  }
  try {
    return await updatePassword(prev, form);
  } catch {
    return { status: "error", message: "Couldn't reach the server. Check your connection and try again." };
  }
}

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(submit, { status: "idle" });
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ids = { field: useId(), error: useId(), hint: useId() };
  const fieldError = state.status === "error" && state.field ? state.message : null;
  const formError = state.status === "error" && !state.field ? state.message : null;

  useEffect(() => {
    if (fieldError) input.current?.select();
  }, [fieldError, state]);

  if (state.status === "done") {
    return (
      <div className="flex flex-col items-center text-center" aria-live="polite">
        <KiwiWithKey size={104} title="Kiwi holding a key" />
        <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.01em]">Password saved</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">Use it next time you sign in.</p>
        <Link
          href="/"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-white transition hover:bg-gray-900 active:scale-[0.985]"
        >
          Go to your dashboard <IconArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center text-center">
        <KiwiWithKey size={104} title="Kiwi holding a key" />
        <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.01em]">Choose a new password</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
          For <span className="break-all font-medium text-ink">{email}</span>
        </p>
      </div>
      <form action={action} noValidate className="mt-5 flex flex-col gap-2">
        {/* Lets password managers file the new password under the right account. */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <label htmlFor={ids.field} className="text-[13px] font-medium text-ink-2">
          New password
        </label>
        <div className="relative">
          <input
            ref={input}
            id={ids.field}
            name="password"
            type={reveal ? "text" : "password"}
            required
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            enterKeyHint="go"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? ids.error : ids.hint}
            className={`h-12 w-full rounded-[14px] bg-gray-100 px-4 pr-16 text-[16px] outline-none ring-1 transition focus:bg-white sm:text-[15px] ${
              fieldError ? "ring-danger/60 focus:ring-danger/70" : "ring-transparent focus:ring-accent/40"
            } focus-visible:ring-2`}
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-pressed={reveal}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-1.5 my-auto h-9 rounded-full px-3 text-[12.5px] font-medium text-ink-2 transition hover:bg-gray-150"
          >
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
        <div aria-live="polite" className="contents">
          {fieldError ? (
            <p id={ids.error} className="text-[13px] text-[#c4182b]">
              {fieldError}
            </p>
          ) : (
            <p id={ids.hint} className="text-[12.5px] text-ink-3">
              At least {PASSWORD_MIN} characters.
            </p>
          )}
          {formError && <p className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13.5px] leading-snug text-[#c4182b]">{formError}</p>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`mt-2 flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-medium transition active:scale-[0.985] ${
            pending ? "bg-gray-150 text-ink-2" : "bg-ink text-white hover:bg-gray-900"
          }`}
        >
          {pending ? (
            <>
              <KiwiLoader size={24} label="Saving" /> Saving…
            </>
          ) : (
            "Save password"
          )}
        </button>
      </form>
    </div>
  );
}
