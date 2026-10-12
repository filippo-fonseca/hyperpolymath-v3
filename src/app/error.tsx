"use client";

import { ErrorScreen } from "@/components/ui/error-screen";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <title>Something went wrong · Hyperpolymath</title>
      <ErrorScreen error={error} retry={retry} />
    </>
  );
}
