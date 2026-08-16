import { Suspense } from "react";
import SignInForm from "./SignInForm";

/**
 * Musicosy sign-in / sign-up page.
 *
 * This is a Server Component wrapper. The actual form lives in
 * `SignInForm` (a Client Component) and is wrapped in <Suspense> because
 * it calls `useSearchParams()` — Next.js requires any component reading
 * search params to be inside a Suspense boundary, otherwise the page
 * cannot be statically rendered and the build fails with the
 * "useSearchParams() should be wrapped in a suspense boundary" error.
 *
 * The fallback is intentionally minimal — the form is the only thing on
 * the page that depends on search params, and the page shell (logo, back
 * link, container) is rendered by the server immediately.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
