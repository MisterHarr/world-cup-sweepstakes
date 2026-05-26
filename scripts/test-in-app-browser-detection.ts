/**
 * Tests the in-app browser User-Agent detection used by googleAuth.ts
 * to decide between signInWithPopup (normal browsers) and
 * signInWithRedirect (restricted WKWebView / in-app browsers).
 *
 * Run with:  npx tsx scripts/test-in-app-browser-detection.ts
 */

// Mirror of the private isInAppBrowser() in lib/googleAuth.ts.
// Keep in sync if the regex changes.
function isInAppBrowser(ua: string): boolean {
  return /WhatsApp|Instagram|FBAV|FBAN|FB_IAB|MicroMessenger|Line\/|TikTok|Snapchat|Twitter/i.test(
    ua
  );
}

type Case = { ua: string; expected: boolean; label: string };

const cases: Case[] = [
  // ── Should use redirect (in-app) ────────────────────────────────────────
  {
    label: "WhatsApp iOS",
    expected: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/24.8.77 A",
  },
  {
    label: "WhatsApp Android",
    expected: true,
    ua: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36 WhatsApp/2.24.5.74 A",
  },
  {
    label: "Instagram iOS",
    expected: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 319.0.0.0.50",
  },
  {
    label: "Facebook in-app (FBAV)",
    expected: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20G75 [FBAN/FBIOS;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/16.6;FBSS/3;FBID/phone;FBLC/en_GB;FBOP/5]",
  },
  {
    label: "TikTok iOS",
    expected: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TikTok/31.5.4",
  },
  {
    label: "Snapchat iOS",
    expected: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Snapchat/12.35.0.37 Mobile/15E148",
  },
  {
    label: "WeChat (MicroMessenger) iOS",
    expected: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.43 NetType/WIFI Language/en",
  },
  {
    label: "Twitter/X iOS",
    expected: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter/10.28",
  },
  {
    label: "Line iOS",
    expected: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.19.0",
  },

  // ── Should use popup (normal browsers) ──────────────────────────────────
  {
    label: "Safari iOS (normal)",
    expected: false,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  },
  {
    label: "Chrome iOS",
    expected: false,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.101 Mobile/15E148 Safari/604.1",
  },
  {
    label: "Chrome Android",
    expected: false,
    ua: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36",
  },
  {
    label: "Firefox Android",
    expected: false,
    ua: "Mozilla/5.0 (Android 13; Mobile; rv:122.0) Gecko/122.0 Firefox/122.0",
  },
  {
    label: "Chrome macOS",
    expected: false,
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  {
    label: "Safari macOS",
    expected: false,
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  },
  {
    label: "Empty UA",
    expected: false,
    ua: "",
  },
];

let passed = 0;
let failed = 0;

console.log("\n── In-app browser detection ────────────────────────────────\n");

for (const { label, ua, expected } of cases) {
  const result = isInAppBrowser(ua);
  const ok = result === expected;
  const icon = ok ? "✅" : "❌";
  const action = result ? "redirect" : "popup";
  console.log(`${icon}  ${label.padEnd(36)} → ${action}`);
  if (!ok) {
    console.log(`     Expected: ${expected ? "redirect" : "popup"}, got: ${action}`);
    console.log(`     UA: ${ua.slice(0, 80)}…`);
    failed++;
  } else {
    passed++;
  }
}

console.log(`\n── Result: ${passed} passed, ${failed} failed ─────────────────────────\n`);

if (failed > 0) process.exit(1);
