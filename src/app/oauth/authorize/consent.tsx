"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { approveAuthorization, denyAuthorization, switchAccount, type ConsentResult } from "@/app/actions/oauth";
import { AUTHORIZE_FIELDS, type AuthorizeParams } from "@/lib/oauth-fields";
import { Logotype, KiwiMark } from "@/components/ui/brand";
import { ProfileAvatar } from "@/components/ui/bot-avatar";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { KiwiLost } from "@/components/illustrations";
import { IconActivity, IconCheck, IconEye, IconPencil, IconShield, IconUndo } from "@/components/ui/icons";

type ClientInfo = { name: string; logoUri: string | null; clientUri: string | null; verifiedDomain: string | null };
type Profile = { email: string; display_name: string | null; avatar_url: string | null };
type Phase = "idle" | "approving" | "connected" | "denying" | "denied";

const SPRING: Transition = { type: "spring", stiffness: 380, damping: 30, mass: 0.8 };
const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------------- shell ---------------- */

export function ConsentShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 pb-[max(40px,env(safe-area-inset-bottom))]">
      <Aurora />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-5 flex justify-center">
          <Link href="/" className="text-[22px] leading-none text-ink transition-opacity hover:opacity-70">
            <Logotype />
          </Link>
        </div>
        {children}
        <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-3">
          Hyperpolymath never shares your password with connected apps.
        </p>
      </div>
    </main>
  );
}

/** Two slow, soft light blobs behind the card. Still when reduced motion is on. */
function Aurora() {
  const still = useReducedMotion();
  const drift = (dx: number, dy: number, duration: number) =>
    still ? {} : { animate: { x: [0, dx, 0], y: [0, dy, 0] }, transition: { duration, repeat: Infinity, ease: "easeInOut" as const } };
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute left-1/2 top-[-18%] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,132,254,0.13),transparent)]"
        {...drift(40, 24, 14)}
      />
      <motion.div
        className="absolute bottom-[-22%] right-[-12%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(47,178,107,0.08),transparent)]"
        {...drift(-30, -20, 18)}
      />
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  const still = useReducedMotion();
  return (
    <motion.div
      initial={still ? false : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-[28px] bg-surface p-6 shadow-pop sm:p-7"
    >
      {children}
    </motion.div>
  );
}

/* ---------------- error ---------------- */

export function ConsentError({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <div className="flex flex-col items-center text-center" role="alert">
        <KiwiLost size={112} title="Kiwi looking around, lost" />
        <h1 className="mt-3 text-[19px] font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{detail}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
          Nothing was connected. Start again from the app you were setting up.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-gray-150 px-4 text-[14px] font-medium transition hover:bg-gray-200"
        >
          Open your dashboard
        </Link>
      </div>
    </Card>
  );
}

/* ---------------- consent ---------------- */

const PERMISSIONS = [
  { icon: IconEye, title: "See your dashboard", body: "Tasks, habits, reminders, captures, projects, widgets and your calendar." },
  { icon: IconPencil, title: "Make changes for you", body: "Add and complete tasks, log habits, set reminders, publish widgets." },
  { icon: IconUndo, title: "Every change is logged", body: "You can review and undo anything it does in Activity." },
  { icon: IconShield, title: "You stay in control", body: "Disconnect it any time in Settings, under Assistants." },
] as const;

export function ConsentCard({
  params,
  selfPath,
  client,
  returnTo,
  profile,
}: {
  params: AuthorizeParams;
  selfPath: string;
  client: ClientInfo;
  returnTo: string;
  profile: Profile;
}) {
  const still = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const allowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    allowRef.current?.focus({ preventScroll: true });
  }, []);

  // Leave once the success animation has played; offer a manual link if the
  // browser doesn't follow (an app scheme with no app installed, say).
  useEffect(() => {
    if (!target) return;
    const go = window.setTimeout(() => window.location.assign(target), still ? 150 : phase === "connected" ? 1100 : 350);
    const late = window.setTimeout(() => setSlow(true), 4500);
    return () => {
      window.clearTimeout(go);
      window.clearTimeout(late);
    };
  }, [target, phase, still]);

  const submit = async (kind: "approve" | "deny") => {
    if (phase !== "idle") return;
    setError(null);
    setPhase(kind === "approve" ? "approving" : "denying");
    const form = new FormData();
    for (const k of AUTHORIZE_FIELDS) if (params[k]) form.set(k, params[k]!);
    let res: ConsentResult;
    try {
      res = await (kind === "approve" ? approveAuthorization(form) : denyAuthorization(form));
    } catch {
      res = { ok: false, error: "Couldn't reach Hyperpolymath. Check your connection and try again." };
    }
    if (!res.ok) {
      setPhase("idle");
      setError(res.error);
      return;
    }
    setPhase(kind === "approve" ? "connected" : "denied");
    setTarget(res.redirect);
  };

  const notYou = async () => {
    const to = await switchAccount(selfPath);
    window.location.assign(to);
  };

  const busy = phase !== "idle";
  const done = phase === "connected" || phase === "denied";
  const who = profile.display_name?.trim() || profile.email || "your account";

  return (
    <Card>
      <ConnectionVisual client={client} phase={phase} />

      <div className="mt-5 text-center">
        <h1 className="text-[21px] font-semibold leading-tight tracking-[-0.015em]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={phase === "connected" ? "c" : phase === "denied" ? "d" : "q"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="inline-block"
            >
              {phase === "connected" ? (
                <>
                  {client.name} is connected
                </>
              ) : phase === "denied" ? (
                <>Not connected</>
              ) : (
                <>
                  Connect <span className="text-accent">{client.name}</span> to your Hyperpolymath?
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </h1>
        <div className="mt-2.5 inline-flex max-w-full items-center gap-2 rounded-full bg-gray-100 py-1 pl-1 pr-3 text-[13px] text-ink-2">
          <ProfileAvatar profile={profile} size={22} />
          <span className="truncate">
            Signed in as <span className="font-medium text-ink">{who}</span>
          </span>
          {!busy && (
            <button type="button" onClick={() => void notYou()} className="shrink-0 font-medium text-accent hover:underline">
              Not you?
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!done && (
          <motion.div
            key="body"
            initial={false}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="mt-5 overflow-hidden"
          >
            <ul className="flex flex-col gap-1" aria-label={`What ${client.name} can do`}>
              {PERMISSIONS.map((p, i) => (
                <motion.li
                  key={p.title}
                  initial={still ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.18 + i * 0.06, duration: 0.4, ease: EASE }}
                  className="flex gap-3 rounded-[16px] px-2.5 py-2 transition-colors hover:bg-gray-50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
                    <p.icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium">{p.title}</span>
                    <span className="block text-[13px] leading-snug text-ink-3">{p.body}</span>
                  </span>
                </motion.li>
              ))}
            </ul>

            <Provenance client={client} returnTo={returnTo} />

            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13px] leading-snug text-[#c4172b]"
              >
                {error}
              </motion.p>
            )}

            <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-2.5">
              <button
                type="button"
                onClick={() => void submit("deny")}
                disabled={busy}
                className="inline-flex h-12 items-center justify-center rounded-full bg-gray-150 text-[15px] font-medium text-ink transition-[background,transform,opacity] hover:bg-gray-200 active:scale-[0.97] disabled:opacity-45"
              >
                {phase === "denying" ? <KiwiLoader size={20} label="Cancelling" /> : "Cancel"}
              </button>
              <motion.button
                ref={allowRef}
                type="button"
                onClick={() => void submit("approve")}
                disabled={busy}
                whileTap={busy ? undefined : { scale: 0.97 }}
                className="relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-ink text-[15px] font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-default"
              >
                {phase === "approving" ? (
                  <>
                    <Shimmer />
                    <span className="relative">Connecting…</span>
                  </>
                ) : (
                  <>Allow access</>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {done && (
          <motion.div
            key="leaving"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35, ease: EASE }}
            className="mt-4 text-center text-[14px] leading-relaxed text-ink-2"
            aria-live="polite"
          >
            <p>
              Taking you back to <span className="font-medium text-ink">{returnTo}</span>…
            </p>
            {slow && target && (
              <p className="mt-2 text-[13px] text-ink-3">
                Nothing happening?{" "}
                <a href={target} className="font-medium text-accent hover:underline">
                  Continue
                </a>{" "}
                or close this tab and return to the app.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/** Who is asking and where the person goes next: the facts that matter for trust. */
function Provenance({ client, returnTo }: { client: ClientInfo; returnTo: string }) {
  return (
    <div className="mt-4 rounded-[16px] bg-gray-100 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-2">
      {client.verifiedDomain ? (
        <p className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success text-white">
            <IconCheck size={10} strokeWidth={3} />
          </span>
          Identity published by <span className="font-medium text-ink">{client.verifiedDomain}</span>
        </p>
      ) : (
        <p>
          <span className="font-medium text-ink">&ldquo;{client.name}&rdquo;</span> is the name the app gave itself. Only continue if you just started
          connecting it.
        </p>
      )}
      <p className="mt-1">
        After you choose, you&apos;ll go back to <span className="font-medium text-ink">{returnTo}</span>.
      </p>
    </div>
  );
}

/** A light sweep across the button while it works. */
function Shimmer() {
  const still = useReducedMotion();
  if (still) return null;
  return (
    <motion.span
      aria-hidden
      className="absolute inset-y-0 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]"
      initial={{ x: "-120%" }}
      animate={{ x: "320%" }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ---------------- the connection visual ---------------- */

const TILE_TONES = [
  ["#eef5ff", "#1084fe"],
  ["#f2fbf5", "#24935a"],
  ["#fff6ec", "#c26a12"],
  ["#f6f0ff", "#7a4fd6"],
  ["#fff0f2", "#d0344b"],
] as const;

function toneFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_TONES[h % TILE_TONES.length];
}

function ClientTile({ client }: { client: ClientInfo }) {
  const [broken, setBroken] = useState(false);
  const [bg, fg] = toneFor(client.name);
  if (client.logoUri && !broken) {
    return (
      <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] bg-white shadow-ring">
        {/* eslint-disable-next-line @next/next/no-img-element -- third-party client logos, any host */}
        <img
          src={client.logoUri}
          alt=""
          width={40}
          height={40}
          referrerPolicy="no-referrer"
          className="h-10 w-10 object-contain"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }
  return (
    <span
      className="flex h-16 w-16 items-center justify-center rounded-[20px] text-[26px] font-semibold shadow-ring"
      style={{ background: bg, color: fg }}
    >
      {client.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function ConnectionVisual({ client, phase }: { client: ClientInfo; phase: Phase }) {
  const still = useReducedMotion();
  const connected = phase === "connected";
  const denied = phase === "denied";
  const working = phase === "approving";
  const pull = connected && !still ? 10 : 0;

  return (
    <div className="flex items-center justify-center" aria-hidden>
      <motion.div animate={{ x: pull }} transition={SPRING}>
        <ClientTile client={client} />
      </motion.div>

      <div className="relative mx-2 h-16 w-[104px]">
        <svg viewBox="0 0 104 64" className="absolute inset-0 h-full w-full overflow-visible">
          {/* Waiting: a dotted path that drifts toward Hyperpolymath. */}
          <motion.line
            x1="6"
            y1="32"
            x2="98"
            y2="32"
            stroke={denied ? "var(--gray-300)" : "var(--gray-400)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="0.5 7"
            animate={still || connected ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -15] }}
            transition={still || connected ? { duration: 0 } : { duration: working ? 0.35 : 1.2, repeat: Infinity, ease: "linear" }}
          />
          {/* Connected: the line draws itself solid. */}
          <motion.line
            x1="6"
            y1="32"
            x2="98"
            y2="32"
            stroke="var(--success)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: connected ? 1 : 0, opacity: connected ? 1 : 0 }}
            transition={{ duration: still ? 0 : 0.45, ease: EASE }}
          />
        </svg>

        {/* A spark travelling along the line while idle or working. */}
        {!still && !connected && !denied && (
          <motion.span
            className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(16,132,254,0.45)]"
            initial={{ left: "4%", opacity: 0 }}
            animate={{ left: ["4%", "90%"], opacity: [0, 1, 1, 0] }}
            transition={{ duration: working ? 0.6 : 1.8, repeat: Infinity, ease: "easeInOut", repeatDelay: working ? 0 : 0.5 }}
          />
        )}

        {/* Centre badge: a quiet pulse, then a check. */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <AnimatePresence mode="popLayout" initial={false}>
            {connected ? (
              <motion.span
                key="ok"
                initial={{ scale: 0.3, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ ...SPRING, delay: still ? 0 : 0.25 }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white shadow-[0_6px_18px_rgba(47,178,107,0.4)]"
              >
                <IconCheck size={16} strokeWidth={3} />
              </motion.span>
            ) : (
              <motion.span
                key="wait"
                exit={{ scale: 0.4, opacity: 0 }}
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-ring"
              >
                {!still && !denied && (
                  <motion.span
                    className="absolute inset-0 rounded-full ring-2 ring-accent/30"
                    animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <IconActivity size={15} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.div animate={{ x: -pull }} transition={SPRING}>
        <motion.span
          className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-ink text-white"
          animate={{
            boxShadow: connected
              ? "0 0 0 4px rgba(47,178,107,0.22), 0 10px 26px rgba(20,20,20,0.18)"
              : "0 0 0 0px rgba(47,178,107,0), 0 10px 26px rgba(20,20,20,0.14)",
          }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <KiwiMark size={34} />
        </motion.span>
      </motion.div>
    </div>
  );
}
