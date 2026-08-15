"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

/**
 * Sign-out button.
 *
 * Calls `onSignedOut` BEFORE the actual signOut() so callers can flush any
 * cached user data. Then performs the Supabase sign-out, navigates to
 * /signin, and forces a full refresh so no stale client state survives.
 */
export function DashboardSignOutButton({
  onSignedOut,
}: {
  onSignedOut?: () => void;
}) {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [pending, start] = useTransition();

  async function signOut() {
    // Flush caches first so a fast navigation can't rehydrate stale state.
    onSignedOut?.();
    await supabase.auth.signOut();
    router.replace("/signin");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => signOut())}
      className="mt-1 flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      <LogOut className="size-3.5" />
      Sign out
    </button>
  );
}
