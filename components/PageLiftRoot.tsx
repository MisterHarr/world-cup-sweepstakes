"use client";

import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const LIFT_OUT_MS = 160; // sync: --ff-lift-out-ms
const LIFT_IN_MS = 200; // sync: --ff-lift-in-ms

function PageLiftInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [displayedChildren, setDisplayedChildren] = useState<ReactNode>(children);
  const [liftPhase, setLiftPhase] = useState<"static" | "out" | "in">("static");
  const [reduceMotion, setReduceMotion] = useState(false);

  const prevRouteKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const h = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useLayoutEffect(() => {
    if (prevRouteKeyRef.current === null) {
      prevRouteKeyRef.current = routeKey;
      setDisplayedChildren(children);
      return;
    }

    if (routeKey === prevRouteKeyRef.current) {
      setDisplayedChildren(children);
      return;
    }

    if (reduceMotion) {
      prevRouteKeyRef.current = routeKey;
      setDisplayedChildren(children);
      setLiftPhase("static");
      return;
    }

    setLiftPhase("out");
    const timerHolder: { inner?: number } = {};
    const outerId = window.setTimeout(() => {
      prevRouteKeyRef.current = routeKey;
      setDisplayedChildren(children);
      setLiftPhase("in");
      timerHolder.inner = window.setTimeout(() => {
        setLiftPhase("static");
      }, LIFT_IN_MS) as number;
    }, LIFT_OUT_MS) as number;

    return () => {
      window.clearTimeout(outerId);
      if (timerHolder.inner !== undefined) {
        window.clearTimeout(timerHolder.inner);
      }
    };
  }, [routeKey, children, reduceMotion]);

  const liftClass =
    liftPhase === "out"
      ? "ff-page-lift-out"
      : liftPhase === "in"
        ? "ff-page-lift-in"
        : "ff-page-lift-static";

  return (
    <div className={cn("min-h-0", liftClass)}>
      {displayedChildren}
    </div>
  );
}

/**
 * Featured Five — route transition on pathname / searchParams changes.
 * Uses opacity-only lift (see `globals.css`) so fixed UI (bottom nav) is not trapped by a transformed ancestor.
 */
export function PageLiftRoot({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="ff-page-lift-static min-h-0">{children}</div>}>
      <PageLiftInner>{children}</PageLiftInner>
    </Suspense>
  );
}
