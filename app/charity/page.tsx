import { notFound } from "next/navigation";

import { CHARITY_CONFIG } from "@/lib/charity";
import CharityPageClient from "./page.client";

export default function CharityPage() {
  if (!CHARITY_CONFIG.enabled) {
    notFound();
  }

  return <CharityPageClient />;
}
