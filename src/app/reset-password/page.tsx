import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentEmail } from "@/lib/session";
import { Logotype } from "@/components/ui/brand";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "New password" };

// Where a password reset link lands (via /auth/callback, which signs the
// account in for this purpose). Without a session the link has expired.

export default async function ResetPasswordPage() {
  const email = await currentEmail();
  if (!email) redirect("/login?error=link_expired");
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-12 pb-[max(48px,env(safe-area-inset-bottom))]">
      <div className="relative w-full max-w-[380px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-[30px] leading-none">
            <Logotype />
          </h1>
        </div>
        <div className="rounded-[26px] bg-surface p-6 shadow-pop">
          <ResetPasswordForm email={email} />
        </div>
      </div>
    </main>
  );
}
