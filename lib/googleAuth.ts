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

/**
 * Returns true when running inside a social/messaging in-app browser
 * (WhatsApp, Instagram, Facebook, TikTok, Twitter/X, Snapchat, WeChat, Line…).
 * These browsers use a restricted WKWebView on iOS that blocks the popup
 * postMessage handshake Firebase relies on, so signInWithRedirect must be used.
 */
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /WhatsApp|Instagram|FBAV|FBAN|FB_IAB|MicroMessenger|Line\/|TikTok|Snapchat|Twitter/i.test(
    ua
  );
}

export async function signInWithGoogle(
  auth: Auth
): Promise<GoogleSignInMode> {
  if (inFlightSignIn) return inFlightSignIn;

  inFlightSignIn = (async (): Promise<GoogleSignInMode> => {
    const provider = buildGoogleProvider();
    if (isInAppBrowser()) {
      // signInWithRedirect navigates the page away — the promise never
      // resolves here. getRedirectResult() handles the callback on reload.
      await signInWithRedirect(auth, provider);
      return "redirect";
    }
    await signInWithPopup(auth, provider);
    return "popup";
  })();

  try {
    return await inFlightSignIn;
  } finally {
    inFlightSignIn = null;
  }
}
