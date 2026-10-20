"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  requestPasswordReset,
  resendConfirmation,
  signInWithPassword,
  signUpWithPassword,
  type AuthMode,
  type AuthState,
} from "@/app/actions/auth";
import { EMAIL_RE, LOGIN_ERROR_TEXT, PASSWORD_MIN, asLoginError, reasonFromParams, safeNextPath, type LoginErrorReason } from "@/lib/auth-errors";
import { IconArrowRight } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { KiwiMail, KiwiWithKey } from "@/components/illustrations";

/** Seconds before another email can be requested from this screen. */
const RESEND_COOLDOWN = 60;

const SERVER: Record<string, (prev: AuthState, form: FormData) => Promise<AuthState>> = {
  sign_in: signInWithPassword,
  sign_up: signUpWithPassword,
  forgot: requestPasswordReset,
  resend_confirm: resendConfirmation,
  resend_reset: requestPasswordReset,
};

const modeOf = (s: AuthState): AuthMode => ("mode" in s ? s.mode : "sign_in");
const emailOf = (s: AuthState) => ("email" in s ? (s.email ?? "") : "");

/** Client side of the actions: routes by intent, validates, survives being offline, stamps local times. */
async function submit(prev: AuthState, form: FormData): Promise<AuthState> {
  const intent = String(form.get("intent") ?? "");
  if (intent.startsWith("mode:")) {
    return { status: "idle", mode: intent.slice(5) as AuthMode, email: String(form.get("email") ?? emailOf(prev)) };
  }
  const run = SERVER[intent];
  if (!run) return prev;
  const mode: AuthMode = intent === "sign_up" ? "sign_up" : intent === "forgot" || intent === "resend_reset" ? "forgot" : "sign_in";
  const email = String(form.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { status: "error", mode, field: "email", email, message: email ? "That doesn't look like an email address." : "Enter your email address." };
  }
  if ((intent === "sign_in" || intent === "sign_up") && !String(form.get("password") ?? "")) {
    return { status: "error", mode, field: "password", email, message: intent === "sign_up" ? "Choose a password." : "Enter your password." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "error", mode, email, message: "You're offline. Reconnect, then try again." };
  }
  try {
    const res = await run(prev, form);
    if (res.status === "check_email") return { ...res, sentAt: Date.now() };
    if (res.status === "rate_limited") return { ...res, at: Date.now() };
    return res;
  } catch {
    return { status: "error", mode, email, message: "Couldn't reach the server. Check your connection and try again." };
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
  const params = useSearchParams();
  const initialMode: AuthMode = params.get("mode") === "sign_up" ? "sign_up" : "sign_in";
  const [state, action, pending] = useActionState<AuthState, FormData>(submit, { status: "idle", mode: initialMode });
  const linkError = useLinkError();
  const next = safeNextPath(params.get("next"));

  // The session cookie is set by the action; a full load lets the proxy see it.
  useEffect(() => {
    if (state.status === "signed_in") window.location.assign(state.next);
  }, [state]);

  if (state.status === "signed_in") {
    return (
      <div className="flex h-[330px] flex-col items-center justify-center gap-3 text-[14px] text-ink-2" aria-live="polite">
        <KiwiLoader size={44} label="Opening your dashboard" />
        Opening your dashboard…
      </div>
    );
  }
  if (state.status === "check_email") return <CheckEmailView state={state} action={action} pending={pending} />;
  const fresh = state.status === "idle" && state.email === undefined;
  return <FormView key={modeOf(state)} state={state} action={action} pending={pending} next={next} linkError={fresh ? linkError : null} />;
}

/* ---------------- sign in, create account, forgot password ---------------- */

const COPY: Record<AuthMode, { title: string; sub: string; submit: string; busy: string }> = {
  sign_in: { title: "Sign in", sub: "Welcome back.", submit: "Sign in", busy: "Signing in…" },
  sign_up: { title: "Create your account", sub: "Your own dashboard. Nobody else can see what's on it.", submit: "Create account", busy: "Creating account…" },
  forgot: { title: "Reset your password", sub: "We'll email you a link to choose a new one.", submit: "Send reset link", busy: "Sending link…" },
};

function FormView({
  state,
  action,
  pending,
  next,
  linkError,
}: {
  state: Exclude<AuthState, { status: "signed_in" } | { status: "check_email" }>;
  action: (fd: FormData) => void;
  pending: boolean;
  next: string;
  linkError: LoginErrorReason | null;
}) {
  const mode = state.mode;
  const copy = COPY[mode];
  const [email, setEmail] = useState(emailOf(state));
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const ids = { email: useId(), password: useId(), error: useId(), notice: useId(), hint: useId() };
  const limited = state.status === "rate_limited" ? state : null;
  const waitLeft = useSecondsLeft(limited ? limited.at + limited.retryAfter * 1000 : null, limited?.retryAfter ?? 0);
  const err = state.status === "error" ? state : null;
  const emailError = err?.field === "email" ? err.message : null;
  const passwordError = err?.field === "password" ? err.message : null;
  const formError = err && !err.field ? err.message : null;

  // Put the cursor in the field that needs fixing.
  useEffect(() => {
    if (emailError) emailInput.current?.focus();
    else if (passwordError) passwordInput.current?.select();
  }, [emailError, passwordError, state]);

  const blocked = pending || (limited !== null && waitLeft > 0);
  const switchTo = (to: AuthMode) => {
    const fd = new FormData();
    fd.set("intent", `mode:${to}`);
    fd.set("email", email);
    startTransition(() => action(fd));
  };
  const resend = () => {
    const fd = new FormData();
    fd.set("intent", "resend_confirm");
    fd.set("email", email);
    startTransition(() => action(fd));
  };

  const field = (invalid: boolean) =>
    `h-12 w-full rounded-[14px] bg-gray-100 px-4 text-[16px] outline-none ring-1 transition placeholder:text-ink-3 focus:bg-white sm:text-[15px] ${
      invalid ? "ring-danger/60 focus:ring-danger/70" : "ring-transparent focus:ring-accent/40"
    } focus-visible:ring-2`;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center text-center">
        <KiwiWithKey size={104} title="Kiwi holding a key" />
        <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.01em]">{copy.title}</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{copy.sub}</p>
      </div>

      {mode !== "forgot" && (
        <div role="tablist" aria-label="Sign in or create an account" className="mt-5 grid grid-cols-2 rounded-full bg-gray-100 p-1 text-[13.5px] font-medium">
          {(["sign_in", "sign_up"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              disabled={pending}
              onClick={() => mode !== m && switchTo(m)}
              className={`h-9 rounded-full transition ${mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
            >
              {m === "sign_in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      {linkError && (
        <div id={ids.notice} role="alert" className="mt-5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-[13.5px] leading-snug">
          <p className="font-semibold text-[#c4182b]">{LOGIN_ERROR_TEXT[linkError].title}</p>
          <p className="mt-0.5 text-ink-2">{LOGIN_ERROR_TEXT[linkError].body}</p>
        </div>
      )}

      <form action={action} noValidate className="mt-5 flex flex-col gap-2" aria-describedby={linkError ? ids.notice : undefined}>
        <input type="hidden" name="intent" value={mode} />
        <input type="hidden" name="next" value={next} />
        <label htmlFor={ids.email} className="text-[13px] font-medium text-ink-2">
          Email
        </label>
        <input
          ref={emailInput}
          id={ids.email}
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete={mode === "sign_up" ? "email" : "username"}
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={mode === "forgot" ? "send" : "next"}
          placeholder="you@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? ids.error : undefined}
          className={field(!!emailError)}
        />
        {emailError && (
          <p id={ids.error} aria-live="polite" className="text-[13px] text-[#c4182b]">
            {emailError}
          </p>
        )}

        {mode !== "forgot" && (
          <>
            <div className="mt-2 flex items-baseline justify-between">
              <label htmlFor={ids.password} className="text-[13px] font-medium text-ink-2">
                Password
              </label>
              {mode === "sign_in" && (
                <button type="button" onClick={() => switchTo("forgot")} disabled={pending} className="text-[13px] font-medium text-accent hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                ref={passwordInput}
                id={ids.password}
                name="password"
                type={reveal ? "text" : "password"}
                required
                minLength={mode === "sign_up" ? PASSWORD_MIN : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "sign_up" ? "new-password" : "current-password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? `${ids.error}-pw` : mode === "sign_up" ? ids.hint : undefined}
                className={`${field(!!passwordError)} pr-16`}
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
            {passwordError ? (
              <p id={`${ids.error}-pw`} aria-live="polite" className="text-[13px] text-[#c4182b]">
                {passwordError}
              </p>
            ) : (
              mode === "sign_up" && (
                <p id={ids.hint} className="text-[12.5px] text-ink-3">
                  At least {PASSWORD_MIN} characters.
                </p>
              )
            )}
          </>
        )}

        <div aria-live="polite" className="contents">
          {formError && <p className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13.5px] leading-snug text-[#c4182b]">{formError}</p>}
          {err?.unconfirmed && (
            <button
              type="button"
              onClick={resend}
              disabled={pending}
              className="h-10 rounded-full bg-gray-150 text-[13.5px] font-medium text-ink transition hover:bg-gray-200"
            >
              Send the confirmation email again
            </button>
          )}
          {limited && (
            <p className="rounded-[12px] bg-gray-100 px-3.5 py-2.5 text-[13.5px] leading-snug text-ink-2">
              Too many tries in a short while, so the next one has to wait a moment.
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
              <KiwiLoader size={24} label={copy.busy} />
              {copy.busy}
            </>
          ) : limited && waitLeft > 0 ? (
            <span className="tabular-nums">Try again in {clock(waitLeft)}</span>
          ) : (
            <>
              {copy.submit} <IconArrowRight size={16} />
            </>
          )}
        </button>

        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => switchTo("sign_in")}
            disabled={pending}
            className="mt-1 h-10 rounded-full px-4 text-[13.5px] font-medium text-accent transition hover:bg-accent-soft"
          >
            Back to sign in
          </button>
        )}
      </form>
    </div>
  );
}

/* ---------------- check your email ---------------- */

function CheckEmailView({
  state,
  action,
  pending,
}: {
  state: Extract<AuthState, { status: "check_email" }>;
  action: (fd: FormData) => void;
  pending: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const left = useSecondsLeft(state.sentAt + RESEND_COOLDOWN * 1000, RESEND_COOLDOWN);
  const confirm = state.reason === "confirm";

  useEffect(() => {
    heading.current?.focus();
  }, [state.sentAt]);

  const back = () => {
    const fd = new FormData();
    fd.set("intent", "mode:sign_in");
    fd.set("email", state.email);
    startTransition(() => action(fd));
  };

  return (
    <div className="flex flex-col items-center text-center" aria-live="polite">
      <KiwiMail size={128} title="Kiwi with a letter" />
      <h2 ref={heading} tabIndex={-1} className="mt-3 text-[19px] font-semibold tracking-[-0.01em] outline-none">
        Check your email
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
        {confirm ? (
          <>
            We sent a confirmation link to <span className="break-all font-medium text-ink">{state.email}</span>. Open it in this browser and you&apos;re in.
          </>
        ) : (
          <>
            If <span className="break-all font-medium text-ink">{state.email}</span> has an account, a reset link is on its way. Open it in this browser.
          </>
        )}
      </p>
      <p className="mt-2 text-[12.5px] text-ink-3">Nothing yet? Give it a minute and check spam.</p>

      <form action={action} className="mt-5 w-full">
        <input type="hidden" name="intent" value={confirm ? "resend_confirm" : "resend_reset"} />
        <input type="hidden" name="email" value={state.email} />
        <button
          type="submit"
          disabled={pending || left > 0}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gray-150 text-[14px] font-medium text-ink transition hover:bg-gray-200 active:scale-[0.985] disabled:text-ink-3 disabled:hover:bg-gray-150"
        >
          {pending ? (
            <>
              <KiwiLoader size={20} label="Sending another email" /> Sending…
            </>
          ) : left > 0 ? (
            <span className="tabular-nums">Resend in {clock(left)}</span>
          ) : (
            "Resend email"
          )}
        </button>
      </form>
      <button
        type="button"
        onClick={back}
        disabled={pending}
        className="mt-2 h-10 rounded-full px-4 text-[13.5px] font-medium text-accent transition hover:bg-accent-soft"
      >
        Back to sign in
      </button>
    </div>
  );
}
