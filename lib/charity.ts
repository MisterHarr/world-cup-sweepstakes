import { FEATURES } from "@/lib/features";

function asTrimmed(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export const CHARITY_CONFIG = {
  enabled: FEATURES.charityPot,
  campaignName:
    asTrimmed(process.env.NEXT_PUBLIC_CHARITY_CAMPAIGN_NAME) ||
    "GIS Charity Pot",
  beneficiaryName:
    asTrimmed(process.env.NEXT_PUBLIC_CHARITY_BENEFICIARY) ||
    "Approved School Charity Partner",
  stripePaymentLink: asTrimmed(process.env.NEXT_PUBLIC_CHARITY_STRIPE_URL),
  paypalDonateLink: asTrimmed(process.env.NEXT_PUBLIC_CHARITY_PAYPAL_URL),
  termsUrl: asTrimmed(process.env.NEXT_PUBLIC_CHARITY_TERMS_URL),
  disclaimer:
    asTrimmed(process.env.NEXT_PUBLIC_CHARITY_DISCLAIMER) ||
    "Contributions are optional and processed by third-party payment providers.",
} as const;

export function hasAnyCharityRail(): boolean {
  return Boolean(
    CHARITY_CONFIG.stripePaymentLink || CHARITY_CONFIG.paypalDonateLink
  );
}
