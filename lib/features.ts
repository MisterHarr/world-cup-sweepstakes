function asEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const token = value.trim().toLowerCase();
  return token === "1" || token === "true" || token === "yes" || token === "on";
}

export const FEATURES = {
  userGuide: true,
  charityPot: asEnabled(process.env.NEXT_PUBLIC_ENABLE_CHARITY_POT),
  prizePot: asEnabled(process.env.NEXT_PUBLIC_ENABLE_PRIZE_POT),
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeatureEnabled(feature: FeatureKey): boolean {
  return FEATURES[feature];
}
