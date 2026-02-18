import { redirect } from "next/navigation";

export default function TransfersPage() {
  redirect("/dashboard?tab=market");
}
