export const PRODUCTION_FIREBASE_PROJECT_ID = "worldcup-sweepstake-2026";

export type AdminEnvironmentLabel = "LOCAL" | "STAGING" | "PRODUCTION";
export type AdminModeLabel = "shadow" | "staging" | "production";

export type AdminEnvironmentInfo = {
  label: AdminEnvironmentLabel;
  mode: AdminModeLabel;
  projectId: string;
  appUrl: string;
  isLocalhost: boolean;
  isProductionProject: boolean;
  requiresProductionAck: boolean;
};

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getAdminEnvironmentInfo(hostname?: string): AdminEnvironmentInfo {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const local = hostname ? isLocalHostname(hostname) : false;
  const isProductionProject = projectId === PRODUCTION_FIREBASE_PROJECT_ID;

  if (local) {
    return {
      label: "LOCAL",
      mode: isProductionProject ? "production" : "shadow",
      projectId,
      appUrl,
      isLocalhost: true,
      isProductionProject,
      requiresProductionAck: isProductionProject,
    };
  }

  if (isProductionProject) {
    return {
      label: "PRODUCTION",
      mode: "production",
      projectId,
      appUrl,
      isLocalhost: false,
      isProductionProject: true,
      requiresProductionAck: false,
    };
  }

  return {
    label: "STAGING",
    mode: "staging",
    projectId,
    appUrl,
    isLocalhost: false,
    isProductionProject: false,
    requiresProductionAck: false,
  };
}
