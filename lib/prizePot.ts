import { FEATURES } from "@/lib/features";

function asTrimmed(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: string | undefined, fallback: number): number {
  const n = Number(asTrimmed(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Derives a stable 4-digit confirmation code from a Firebase UID.
 * Deterministic — same UID always produces the same code.
 * Used so players can include their code as a TnG payment reference,
 * making admin batch-confirmation trivial without any manual name matching.
 */
export function generatePotCode(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash) + uid.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 9000 + 1000).toString();
}

export const PRIZE_POT_CONFIG = {
  enabled: FEATURES.prizePot,
  potName:
    asTrimmed(process.env.NEXT_PUBLIC_PRIZE_POT_NAME) ||
    "World Cup 2026 Prize Pot",
  amountPerEntry: asNumber(process.env.NEXT_PUBLIC_PRIZE_POT_AMOUNT, 5),
  currency:
    asTrimmed(process.env.NEXT_PUBLIC_PRIZE_POT_CURRENCY) || "RM",
  /** URL of the pre-generated Touch 'n Go / DuitNow QR image. */
  qrCodeImageUrl: asTrimmed(process.env.NEXT_PUBLIC_PRIZE_POT_QR_IMAGE_URL),
  /** Optional WhatsApp deep-link for players to notify admin after paying. */
  whatsappConfirmUrl: asTrimmed(process.env.NEXT_PUBLIC_PRIZE_POT_WHATSAPP_URL),
  /** If true the /pot page lists participant display names; if false shows count only. */
  showParticipants:
    asTrimmed(process.env.NEXT_PUBLIC_PRIZE_POT_SHOW_PARTICIPANTS)
      .toLowerCase() === "true",
} as const;
