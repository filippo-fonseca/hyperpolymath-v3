import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Logotype, Monogram } from "@/components/ui/brand";

export const metadata: Metadata = { title: "Sign in · Hyperpolymath" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
      <Backdrop />
      <div className="relative w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Monogram size={44} className="rounded-[14px]" />
          <h1 className="mt-5 text-[30px] leading-none">
            <Logotype />
          </h1>
          <p className="mt-3 text-[15px] text-ink-2">Your calm, one-screen dashboard.</p>
        </div>
        <div className="rounded-[26px] bg-surface p-6 shadow-pop">
          <Suspense fallback={<div className="h-[148px]" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-[13px] text-ink-3">Private dashboard. Single owner.</p>
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
