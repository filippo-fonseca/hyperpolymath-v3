import { Suspense } from "react";
import { requireUser } from "@/lib/session";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Signed />
    </Suspense>
  );
}

async function Signed() {
  await requireUser();
  return <main className="p-6 text-[15px] text-ink-2">Signed in.</main>;
}
