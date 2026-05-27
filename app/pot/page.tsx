import { notFound } from "next/navigation";

import { PRIZE_POT_CONFIG } from "@/lib/prizePot";
import PrizePotPageClient from "./page.client";

export default function PrizePotPage() {
  if (!PRIZE_POT_CONFIG.enabled) {
    notFound();
  }

  return <PrizePotPageClient />;
}
