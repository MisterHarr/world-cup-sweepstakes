import * as admin from "firebase-admin";

admin.initializeApp();

export { ensureUserProfile, assignDrawnTeams, confirmFeaturedTeam, setDepartment } from "./onboarding";
export { adminListUsers, adminAssignTeamsToUser, adminSeedMockUsers } from "./adminUsers";
export { setAdminClaim } from "./admin";
export { getLeaderboard } from "./getLeaderboard";
export { getSquadDetails } from "./getSquadDetails";
export { getTransferHistory } from "./getTransferHistory";
export { executeTransfer } from "./transfers";
export {
  adminUpsertMatch,
  recomputeScores,
  recomputeShadowScores,
  retryDirtyRecompute,
} from "./scoring";
export {
  ingestLiveScores,
  adminIngestFixture,
  adminResetFixtureIngest,
  adminIngestPreTournament,
  adminContractTestProvider,
  setLiveOpsSettings,
} from "./ingest";
export {
  adminResetPublicRehearsalState,
  adminRunLocalLiveSimulatorWave,
  adminReplayFixtureWave,
  adminResetFixtureReplay,
} from "./rehearsal";
export {
  adminDeleteMockUsersByBatch,
  adminPreviewOrphanTeamDeletion,
  adminDeleteOrphanTeamDocs,
} from "./adminSafety";
