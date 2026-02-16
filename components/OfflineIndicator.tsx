"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";

/**
 * Offline indicator component
 * Shows banner when user loses network connection
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Initial state
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setShowReconnected(true);
      // Hide "reconnected" message after 3 seconds
      setTimeout(() => setShowReconnected(false), 3000);
    }

    function handleOffline() {
      setIsOnline(false);
      setShowReconnected(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Don't render anything if online and not showing reconnected message
  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-50 transition-transform duration-300 ${
        isOnline && showReconnected ? "translate-y-0" : ""
      }`}
      role="alert"
      aria-live="assertive"
    >
      {!isOnline && (
        <div className="bg-red-600 px-4 py-3 text-center text-white">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">
              You are offline. Some features may not work.
            </span>
          </div>
        </div>
      )}

      {isOnline && showReconnected && (
        <div className="bg-green-600 px-4 py-3 text-center text-white">
          <div className="flex items-center justify-center gap-2">
            <Wifi className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">Reconnected</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Network status hook
 * Returns current online/offline state
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
