import Link from "next/link";

// Public landing page, shown to signed-out visitors at `/`.
export function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[1080px] flex-col items-center justify-center px-4">
      <Link href="/login">Sign in</Link>
    </main>
  );
}
