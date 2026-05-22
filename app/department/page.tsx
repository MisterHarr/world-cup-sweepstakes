"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DepartmentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/featured-team");
  }, [router]);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 flex items-center justify-center"
      role="status"
      aria-label="Redirecting"
    >
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
