"use client";

import { useActionState, useTransition } from "react";
import { signOut, updatePassword, type PasswordState } from "@/app/actions/auth";
import { PASSWORD_MIN, passwordProblem } from "@/lib/auth-errors";
import { Button, fieldClass } from "@/components/ui/primitives";
import { IconSignOut } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { useToast } from "@/components/ui/toast";
import { Section, cardClass, type SectionProps } from "./shared";

export function AccountSection({ overview }: SectionProps) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const leave = () =>
    startTransition(async () => {
      try {
        await signOut();
      } catch {
        toast.error(navigator.onLine === false ? "You're offline. Sign out once you're back." : "Couldn't sign out. Try again.");
      }
    });

  return (
    <div className="flex flex-col gap-8">
      <Section id="settings-account" title="Signed in as" hint="Everything here belongs to this account. Nobody else can see it.">
        <div className={`${cardClass} flex items-center gap-3 py-3`}>
          {overview ? (
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{overview.email ?? "Unknown"}</span>
          ) : (
            <span className="skeleton h-4 flex-1 rounded-full" aria-label="Loading" />
          )}
          <Button size="sm" variant="ghost" onClick={leave} disabled={pending} className="text-ink-2">
            {pending ? <KiwiLoader size={18} label="Signing out" /> : <IconSignOut size={15} />}
            Sign out
          </Button>
        </div>
      </Section>
      <PasswordSection email={overview?.email ?? null} />
    </div>
  );
}

async function changePassword(prev: PasswordState, form: FormData): Promise<PasswordState> {
  const problem = passwordProblem(String(form.get("password") ?? ""));
  if (problem) return { status: "error", field: "password", message: problem };
  try {
    return await updatePassword(prev, form);
  } catch {
    return { status: "error", message: "Couldn't reach the server. Try again." };
  }
}

function PasswordSection({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, { status: "idle" });

  return (
    <Section title="Password" hint={`Pick a new one. At least ${PASSWORD_MIN} characters.`}>
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        {email && <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />}
        <input
          name="password"
          type="password"
          aria-label="New password"
          placeholder="New password"
          autoComplete="new-password"
          required
          aria-invalid={state.status === "error" ? true : undefined}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? <KiwiLoader size={18} label="Saving" /> : null}
          Change password
        </Button>
      </form>
      <div aria-live="polite">
        {state.status === "error" && <p className="mt-2 text-[13px] text-[#c4182b]">{state.message}</p>}
        {state.status === "done" && !pending && <p className="mt-2 text-[13px] text-ink-2">Password changed.</p>}
      </div>
    </Section>
  );
}
