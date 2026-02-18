import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
} from "firebase/auth";

type GoogleSignInMode = "popup" | "redirect";
let inFlightSignIn: Promise<GoogleSignInMode> | null = null;

function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

export async function signInWithGoogle(
  auth: Auth
): Promise<GoogleSignInMode> {
  if (inFlightSignIn) return inFlightSignIn;

  inFlightSignIn = (async (): Promise<GoogleSignInMode> => {
    const provider = buildGoogleProvider();
    if (isLocalhost()) {
      await signInWithPopup(auth, provider);
      return "popup";
    }
    await signInWithRedirect(auth, provider);
    return "redirect";
  })();

  try {
    return await inFlightSignIn;
  } finally {
    inFlightSignIn = null;
  }
}
