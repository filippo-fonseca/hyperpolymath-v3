import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Logotype } from "@/components/ui/brand";
import { KiwiLoader } from "@/components/ui/kiwi-loader";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12 pb-[max(48px,env(safe-area-inset-bottom))]">
      <Backdrop />
      <div className="relative w-full max-w-[380px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-[30px] leading-none">
            <Logotype />
          </h1>
          <p className="mt-3 text-[15px] text-ink-2">Your calm, one-screen dashboard.</p>
        </div>
        <div className="rounded-[26px] bg-surface p-6 shadow-pop">
          <Suspense
            fallback={
              <div className="flex h-[330px] items-center justify-center">
                <KiwiLoader size={44} />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-[13px] text-ink-3">Each account is private to the person who made it.</p>
      </div>
    </main>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-[-20%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,132,254,0.10),transparent)]" />
    </div>
  );
}
