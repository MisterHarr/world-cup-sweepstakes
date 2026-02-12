import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export function requireAuth(request: CallableRequest) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  return request.auth;
}

export function requireAdmin(request: CallableRequest) {
  const auth = requireAuth(request);
  const isAdmin = (auth.token as { admin?: boolean })?.admin === true;

  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  return auth;
}
