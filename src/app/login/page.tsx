import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Hyperpolymath" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
      <Backdrop />
      <div className="relative w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Mark />
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">Hyperpolymath</h1>
          <p className="mt-1.5 text-[15px] text-ink-2">Your calm, one-screen dashboard.</p>
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

function Mark() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <rect x="4" y="4" width="22" height="22" rx="8" fill="#1084fe" />
      <rect x="30" y="4" width="22" height="22" rx="8" fill="#141414" />
      <rect x="4" y="30" width="48" height="22" rx="8" fill="#e8e8e8" />
      <circle cx="12.5" cy="15" r="2" fill="#fff" />
      <circle cx="19.5" cy="15" r="2" fill="#fff" />
    </svg>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-[-20%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,132,254,0.10),transparent)]" />
    </div>
  );
}
