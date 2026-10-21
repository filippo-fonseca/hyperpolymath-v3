import { redirect } from "next/navigation";

// The privacy policy lives on /terms; this keeps the usual URL working.
export default function PrivacyPage() {
  redirect("/terms#privacy");
}
