import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

type PagerItem = {
  label: string;
  href: string;
};

/**
 * Prev / next footer used at the bottom of every docs page.
 *
 * Visually mirrors the Stripe / Linear docs pattern: a 2-column grid
 * with the previous item on the left and the next item on the right.
 * Empty slots render an invisible placeholder so the layout stays
 * balanced on the first / last page of a sequence.
 */
export function DocsPager({
  prev,
  next,
}: {
  prev?: PagerItem;
  next?: PagerItem;
}) {
  return (
    <div className="mt-16 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="group border border-border p-3 transition-colors hover:bg-surface"
        >
          <p className="label-mono flex items-center gap-1">
            <ArrowLeft className="size-3" />
            Previous
          </p>
          <p className="mt-1 text-sm font-medium">{prev.label}</p>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group border border-border p-3 text-right transition-colors hover:bg-surface"
        >
          <p className="label-mono flex items-center justify-end gap-1">
            Next
            <ArrowRight className="size-3" />
          </p>
          <p className="mt-1 text-sm font-medium">{next.label}</p>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
