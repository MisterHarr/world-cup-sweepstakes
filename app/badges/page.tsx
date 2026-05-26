"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function BadgesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div
      className="min-h-screen bg-[var(--ff-bg-app)] text-[var(--ff-fg-primary)] flex items-center justify-center"
      role="status"
      aria-label="Redirecting"
    >
      <Loader2 className="w-8 h-8 animate-spin text-[var(--ff-accent-text)]" />
    </div>
  );
}
