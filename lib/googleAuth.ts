import {
  GoogleAuthProvider,
  signInWithPopup,
  type Auth,
} from "firebase/auth";

type GoogleSignInMode = "popup";
let inFlightSignIn: Promise<GoogleSignInMode> | null = null;

function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export async function signInWithGoogle(
  auth: Auth
): Promise<GoogleSignInMode> {
  if (inFlightSignIn) return inFlightSignIn;

  inFlightSignIn = (async (): Promise<GoogleSignInMode> => {
    const provider = buildGoogleProvider();
    await signInWithPopup(auth, provider);
    return "popup";
  })();

  try {
    return await inFlightSignIn;
  } finally {
    inFlightSignIn = null;
  }
}
