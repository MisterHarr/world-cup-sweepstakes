import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const PRODUCTION_FIREBASE_PROJECT_ID = "worldcup-sweepstake-2026";

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getAdminEnvironmentLabel(): "LOCAL" | "STAGING" | "PRODUCTION" {
  const projectId = process.env.GCLOUD_PROJECT ?? "";
  if (projectId.startsWith("demo-")) return "LOCAL";
  if (projectId === PRODUCTION_FIREBASE_PROJECT_ID) return "PRODUCTION";
  return "STAGING";
}

export async function recordAdminEvent(params: {
  actorUid: string;
  actorEmail?: string | null;
  action: string;
  targetIds?: string[];
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = admin.firestore();
  await db.collection("adminEvents").doc().set(
    {
      actorUid: params.actorUid,
      actorEmail: asTrimmedString(params.actorEmail) ?? null,
      action: params.action,
      targetIds: Array.isArray(params.targetIds) ? params.targetIds : [],
      environment: getAdminEnvironmentLabel(),
      createdAt: FieldValue.serverTimestamp(),
      summary: params.summary.slice(0, 2000),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
    { merge: true }
  );
}
