import Link from "next/link";
import { KeyRound, ArrowRight } from "lucide-react";

/**
 * Sticky "Get your API key" call-to-action pinned to the bottom of the
 * docs sidebar. Mirrors the pattern used by Stripe, Twilio, and Vercel
 * docs — a persistent visual reminder that the next step in the
 * developer journey is acquiring credentials.
 *
 * Links to /signin (Supabase auth) with `next=/dashboard/keys` so the user
 * lands directly on the key-creation page after authenticating. Middleware
 * will preserve this `next` param across the OAuth redirect.
 */
export function GetKeyCta() {
  return (
    <div className="sticky bottom-0 -mx-5 mt-8 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
      <Link
        href="/signin?next=/dashboard/keys"
        className="group flex items-center gap-3 border border-foreground p-3 transition-colors hover:bg-foreground hover:text-background"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center border border-current"
          aria-hidden="true"
        >
          <KeyRound className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold">
            Get your API key
          </span>
          <span className="mt-0.5 block text-[11px] leading-tight opacity-70">
            Authenticate your first request in under a minute.
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}
