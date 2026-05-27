import { FEATURES } from "@/lib/features";

function asTrimmed(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: string | undefined, fallback: number): number {
  const n = Number(asTrimmed(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const PRIZE_POT_CONFIG = {
  enabled: FEATURES.prizePot,
  potName:
    asTrimmed(process.env.NEXT_PUBLIC_PRIZE_POT_NAME) ||
    "World Cup 2026 Prize Pot",
  amountPerEntry: asNumber(process.env.NEXT_PUBLIC_PRIZE_POT_AMOUNT, 10),
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
