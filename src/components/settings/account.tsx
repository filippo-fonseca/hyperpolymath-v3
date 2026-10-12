"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/primitives";
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
    <Section id="settings-account" title="Signed in as" hint="Sign-in uses a one-time email link. Only the owner's address can sign in.">
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
  );
}
