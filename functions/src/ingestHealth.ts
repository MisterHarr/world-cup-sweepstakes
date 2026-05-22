import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export type DirtyReason = "transfer" | "ingest" | "manual" | null;

const COLLECTION = "ingestHealth";
const DOC_ID = "current";

function healthRef(db: FirebaseFirestore.Firestore) {
  return db.collection(COLLECTION).doc(DOC_ID);
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message.trim();
  }

  if (typeof err === "string" && err.trim().length > 0) {
    return err.trim();
  }

  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== "{}") {
      return serialized.slice(0, 1000);
    }
  } catch {
    // ignore serialization failures
  }

  return "Unknown error.";
}

export async function recordIngestAttempt(params: {
  activeProvider: string;
  mode?: string | null;
}): Promise<void> {
  const db = admin.firestore();
  await healthRef(db).set(
    {
      lastIngestAttemptAt: FieldValue.serverTimestamp(),
      activeProvider: params.activeProvider,
      mode: params.mode ?? null,
    },
    { merge: true }
  );
}

export async function recordIngestSuccess(params: {
  activeProvider: string;
  mode?: string | null;
}): Promise<void> {
  const db = admin.firestore();
  await healthRef(db).set(
    {
      lastIngestSuccessAt: FieldValue.serverTimestamp(),
      lastIngestErrorMessage: null,
      activeProvider: params.activeProvider,
      mode: params.mode ?? null,
    },
    { merge: true }
  );
}

export async function recordIngestError(params: {
  activeProvider: string;
  errorMessage: string;
  mode?: string | null;
}): Promise<void> {
  const db = admin.firestore();
  await healthRef(db).set(
    {
      lastIngestErrorAt: FieldValue.serverTimestamp(),
      lastIngestErrorMessage: params.errorMessage.slice(0, 1000),
      activeProvider: params.activeProvider,
      mode: params.mode ?? null,
    },
    { merge: true }
  );
}

export async function recordRecomputeAttempt(): Promise<void> {
  const db = admin.firestore();
  await healthRef(db).set(
    {
      lastRecomputeAttemptAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordRecomputeSuccess(options?: {
  clearDirty?: boolean;
}): Promise<void> {
  const db = admin.firestore();
  const clearDirty = options?.clearDirty !== false;
  await healthRef(db).set(
    {
      lastRecomputeSuccessAt: FieldValue.serverTimestamp(),
      lastRecomputeErrorMessage: null,
      ...(clearDirty
        ? {
            scoresDirty: false,
            dirtyReason: null,
          }
        : {}),
    },
    { merge: true }
  );
}

export async function recordRecomputeError(errorMessage: string): Promise<void> {
  const db = admin.firestore();
  await healthRef(db).set(
    {
      lastRecomputeErrorAt: FieldValue.serverTimestamp(),
      lastRecomputeErrorMessage: errorMessage.slice(0, 1000),
    },
    { merge: true }
  );
}

export async function markScoresDirty(params: {
  reason: DirtyReason;
  errorMessage?: string | null;
}): Promise<void> {
  const db = admin.firestore();
  await healthRef(db).set(
    {
      scoresDirty: true,
      dirtyReason: params.reason,
      ...(params.errorMessage
        ? {
            lastRecomputeErrorAt: FieldValue.serverTimestamp(),
            lastRecomputeErrorMessage: params.errorMessage.slice(0, 1000),
          }
        : {}),
    },
    { merge: true }
  );
}
