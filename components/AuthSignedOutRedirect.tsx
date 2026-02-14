"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";

const PUBLIC_PATHS = new Set<string>(["/", "/login"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

export function AuthSignedOutRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) return;

      const currentPath = pathnameRef.current || "/";
      if (isPublicPath(currentPath)) return;

      router.replace("/login");
    });

    return () => unsub();
  }, [router]);

  return null;
}

