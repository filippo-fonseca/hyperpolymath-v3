"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, type MagicLinkState } from "@/app/actions/auth";
import { EMAIL_RE, LOGIN_ERROR_TEXT, asLoginError, reasonFromParams, type LoginErrorReason } from "@/lib/auth-errors";
import { IconArrowRight } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { KiwiMail, KiwiWithKey } from "@/components/illustrations";

/** Seconds before another link can be requested from this screen. */
const RESEND_COOLDOWN = 60;

/** Client side of the action: validates, survives being offline, stamps local times. */
async function submit(prev: MagicLinkState, form: FormData): Promise<MagicLinkState> {
  if (form.get("intent") === "reset") {
    return { status: "idle", email: "email" in prev ? (prev.email ?? "") : "" };
  }
  const email = String(form.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { status: "error", field: "email", email, message: email ? "That doesn't look like an email address." : "Enter your email address." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "error", email, message: "You're offline. Reconnect, then send the link." };
  }
  try {
    const res = await sendMagicLink(prev, form);
    if (res.status === "sent") return { ...res, sentAt: Date.now() };
    if (res.status === "rate_limited") return { ...res, at: Date.now() };
    return res;
  } catch {
    return { status: "error", email, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** Error from `?error=` (our callback) or Supabase's own `?error_code=` / `#error_code=`. */
function useLinkError(): LoginErrorReason | null {
  const params = useSearchParams();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const own = asLoginError(params.get("error"));
  if (own && !params.get("error_code")) return own;
  return reasonFromParams(params) ?? (hash.length > 1 ? reasonFromParams(new URLSearchParams(hash.slice(1))) : null);
}

/** Whole seconds left until `until` (epoch ms), ticking once a second. */
function useSecondsLeft(until: number | null, total: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (until === null) return;
    const tick = () => setNow(Date.now());
    const t = window.setTimeout(tick, 0);
    const i = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(i);
    };
  }, [until]);
  if (until === null) return 0;
  if (now === null) return total;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function LoginForm() {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(submit, { status: "idle" });
  const linkError = useLinkError();

  if (state.status === "sent") return <SentView state={state} action={action} pending={pending} />;
  return <RequestView state={state} action={action} pending={pending} linkError={state.status === "idle" && state.email === undefined ? linkError : null} />;
}

/* ---------------- request a link ---------------- */

function RequestView({
  state,
  action,
  pending,
  linkError,
}: {
  state: Exclude<MagicLinkState, { status: "sent" }>;
  action: (fd: FormData) => void;
  pending: boolean;
  linkError: LoginErrorReason | null;
}) {
  const [email, setEmail] = useState(state.email ?? "");
  const input = useRef<HTMLInputElement>(null);
  const ids = { field: useId(), error: useId(), notice: useId() };
  const limited = state.status === "rate_limited" ? state : null;
  const waitLeft = useSecondsLeft(limited ? limited.at + limited.retryAfter * 1000 : null, limited?.retryAfter ?? 0);
  const fieldError = state.status === "error" && state.field === "email" ? state.message : null;
  const formError = state.status === "error" && !state.field ? state.message : null;

  // Put the cursor back in the field when it needs fixing.
  useEffect(() => {
    if (fieldError) input.current?.focus();
  }, [fieldError, state]);

  const blocked = pending || (limited !== null && waitLeft > 0);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center text-center">
        <KiwiWithKey size={112} title="Kiwi holding a key" />
        <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.01em]">Sign in</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">We&apos;ll email you a one-time magic link.</p>
      </div>

      {linkError && (
        <div id={ids.notice} role="alert" className="mt-5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-[13.5px] leading-snug">
          <p className="font-semibold text-[#c4182b]">{LOGIN_ERROR_TEXT[linkError].title}</p>
          <p className="mt-0.5 text-ink-2">{LOGIN_ERROR_TEXT[linkError].body}</p>
        </div>
      )}

      <form action={action} noValidate className="mt-5 flex flex-col gap-2" aria-describedby={linkError ? ids.notice : undefined}>
        <label htmlFor={ids.field} className="text-[13px] font-medium text-ink-2">
          Email
        </label>
        <input
          ref={input}
          id={ids.field}
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="you@example.com"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? ids.error : undefined}
          className={`h-12 rounded-[14px] bg-gray-100 px-4 text-[16px] outline-none ring-1 transition placeholder:text-ink-3 focus:bg-white sm:text-[15px] ${
            fieldError ? "ring-danger/60 focus:ring-danger/70" : "ring-transparent focus:ring-accent/40"
          } focus-visible:ring-2`}
        />
        <div aria-live="polite" className="contents">
          {fieldError && (
            <p id={ids.error} className="text-[13px] text-[#c4182b]">
              {fieldError}
            </p>
          )}
          {formError && <p className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13.5px] leading-snug text-[#c4182b]">{formError}</p>}
          {limited && (
            <p className="rounded-[12px] bg-gray-100 px-3.5 py-2.5 text-[13.5px] leading-snug text-ink-2">
              Too many links in a short while, so the next one has to wait a moment. Any link already sent still works.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={blocked}
          className={`mt-2 flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-medium transition active:scale-[0.985] ${
            pending ? "bg-gray-150 text-ink-2" : "bg-ink text-white hover:bg-gray-900 disabled:opacity-60"
          }`}
        >
          {pending ? (
            <>
              <KiwiLoader size={24} label="Sending your link" />
              Sending link…
            </>
          ) : limited && waitLeft > 0 ? (
            <span className="tabular-nums">Try again in {clock(waitLeft)}</span>
          ) : (
            <>
              Send magic link <IconArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

/* ---------------- check your email ---------------- */

function SentView({ state, action, pending }: { state: Extract<MagicLinkState, { status: "sent" }>; action: (fd: FormData) => void; pending: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const left = useSecondsLeft(state.sentAt + RESEND_COOLDOWN * 1000, RESEND_COOLDOWN);

  useEffect(() => {
    heading.current?.focus();
  }, [state.sentAt]);

  const startOver = () => {
    const fd = new FormData();
    fd.set("intent", "reset");
    startTransition(() => action(fd));
  };

  return (
    <div className="flex flex-col items-center text-center" aria-live="polite">
      <KiwiMail size={128} title="Kiwi with a letter" />
      <h2 ref={heading} tabIndex={-1} className="mt-3 text-[19px] font-semibold tracking-[-0.01em] outline-none">
        Check your email
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
        If <span className="break-all font-medium text-ink">{state.email}</span> can sign in here, a link is on its way. Open it in this browser to continue.
      </p>
      <p className="mt-2 text-[12.5px] text-ink-3">Nothing yet? Give it a minute and check spam.</p>

      <form action={action} className="mt-5 w-full">
        <input type="hidden" name="email" value={state.email} />
        <button
          type="submit"
          disabled={pending || left > 0}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gray-150 text-[14px] font-medium text-ink transition hover:bg-gray-200 active:scale-[0.985] disabled:text-ink-3 disabled:hover:bg-gray-150"
        >
          {pending ? (
            <>
              <KiwiLoader size={20} label="Sending another link" /> Sending…
            </>
          ) : left > 0 ? (
            <span className="tabular-nums">Resend link in {clock(left)}</span>
          ) : (
            "Resend link"
          )}
        </button>
      </form>
      <button
        type="button"
        onClick={startOver}
        disabled={pending}
        className="mt-2 h-10 rounded-full px-4 text-[13.5px] font-medium text-accent transition hover:bg-accent-soft"
      >
        Use a different email
      </button>
    </div>
  );
}
