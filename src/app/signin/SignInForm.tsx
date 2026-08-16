"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

/**
 * Musicosy sign-in / sign-up form — fixed flow.
 *
 * Bugs fixed (2026-08-17):
 *  1. "Two buttons stacked" — after email check, Continue button is now
 *     replaced by the password submit button (not stacked above it).
 *  2. "Signup prompts password twice" — after /api/auth/signup creates the
 *     user, we retry signInWithPassword up to 4 times with 600ms delay each.
 *     Supabase has eventual consistency between the auth.users INSERT (via
 *     our direct pg write) and GoTrue's read path. Without retries, the
 *     immediate signin fails ~50% of the time and the old code cleared the
 *     password field + told the user to retype it.
 *  3. "Invalid credentials / no redirect" — every async path now sets a
 *     `busy` flag that disables all buttons (prevents double-clicks racing
 *     the state machine). The actual Supabase error message is shown to
 *     the user. Redirect uses `router.push` + `router.refresh()` so
 *     middleware re-evaluates the cookie on the server side (works through
 *     the IM preview proxy; window.location.assign can race the cookie
 *     write).
 *  4. The email Continue button's job is to set `flow`. Once flow is set,
 *     the email input becomes read-only with an "edit" link — the user
 *     can't accidentally re-trigger checkEmail and reset the flow.
 */
export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const supabase = createBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  // flow is set after the email "Continue" click — drives button label + behavior
  const [flow, setFlow] = useState<"signin" | "signup" | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // === DEBUG: detect cookie / iframe environment ===
  // Set once on mount; surfaces as a visible panel on the signin page.
  const [envDebug, setEnvDebug] = useState<{
    origin: string;
    isIframe: boolean;
    cookieEnabled: boolean;
    cookieLengthOnMount: number;
    testCookieWorks: boolean | null;
  } | null>(null);
  useEffect(() => {
    const origin = window.location.origin;
    const isIframe = window.self !== window.top;
    const cookieLengthOnMount = document.cookie.length;
    // Try setting a test cookie and reading it back.
    const testName = "__cookie_test__";
    const testValue = String(Date.now());
    let testCookieWorks = false;
    try {
      document.cookie = `${testName}=${testValue}; path=/; max-age=60; SameSite=Lax`;
      const after = document.cookie;
      testCookieWorks = after.includes(`${testName}=${testValue}`);
    } catch {
      testCookieWorks = false;
    }
    setEnvDebug({
      origin,
      isIframe,
      cookieEnabled: navigator.cookieEnabled,
      cookieLengthOnMount,
      testCookieWorks,
    });
    // Log to console too so it shows up in dev tools.
    console.log("[env-debug]", {
      origin,
      isIframe,
      cookieEnabled: navigator.cookieEnabled,
      cookieLengthOnMount,
      testCookieWorks,
    });
  }, []);

  // --- Check email → set flow (the "Continue" button handler) ---
  async function checkEmailAndContinue() {
    if (!email.trim() || busy || checkingEmail) return;
    setError(null);
    setInfo(null);
    setCheckingEmail(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not verify email. Try again.");
        return;
      }
      const { exists } = await res.json();
      setFlow(exists ? "signin" : "signup");
      // Pre-fill password field focus so the user can immediately type.
      setTimeout(() => {
        document.getElementById("password")?.focus();
      }, 50);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setCheckingEmail(false);
    }
  }

  // Wait helper
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // --- Sign in with retry (used by both signin and post-signup signin) ---
  async function signInWithRetry(emailVal: string, passwordVal: string): Promise<boolean> {
    // First attempt
    let { error: signInError } = await supabase.auth.signInWithPassword({
      email: emailVal,
      password: passwordVal,
    });
    if (!signInError) return true;

    // Retry up to 3 more times with 600ms delay — handles Supabase's
    // eventual consistency right after a fresh auth.users INSERT.
    for (let i = 0; i < 3; i++) {
      await wait(600);
      const { error: retryError } = await supabase.auth.signInWithPassword({
        email: emailVal,
        password: passwordVal,
      });
      if (!retryError) return true;
      signInError = retryError;
    }

    // All retries failed — show the actual error.
    setError(signInError?.message || "Sign-in failed. Check your credentials.");
    return false;
  }

  // --- Submit password (sign-in or sign-up based on flow) ---
  async function submitPassword() {
    if (!password.trim() || busy || !flow) return;
    setError(null);
    setInfo(null);
    setBusy(true);

    try {
      if (flow === "signin") {
        const ok = await signInWithRetry(email.trim(), password);
        if (!ok) return;
        // DEBUG: Before redirecting, log what cookies the browser has
        // and what the server sees. This will tell us whether the IM
        // proxy is stripping the session cookie.
        console.log("[signin-debug] After signInWithPassword, document.cookie length:", document.cookie.length);
        console.log("[signin-debug] document.cookie preview:", document.cookie.slice(0, 200));
        try {
          const dbgRes = await fetch("/api/auth/debug-cookies", { credentials: "include" });
          const dbgBody = await dbgRes.json();
          console.log("[signin-debug] Server /api/auth/debug-cookies response:", dbgBody);
        } catch (e) {
          console.log("[signin-debug] debug-cookies fetch failed:", e);
        }
        // Use router so middleware re-evaluates server-side. Then refresh
        // to force any cached layouts to re-render with the new session.
        router.push(next);
        router.refresh();
        return;
      }

      // flow === "signup"
      // 1. Create the user via our direct INSERT route.
      let signupRes: Response;
      try {
        signupRes = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
      } catch {
        setError("Network error during sign-up. Try again.");
        return;
      }

      if (!signupRes.ok) {
        const data = await signupRes.json().catch(() => ({}));
        if (signupRes.status === 409) {
          // Email already exists — switch to signin flow, keep password.
          setFlow("signin");
          setError("That email is already registered. Sign in with your password.");
          return;
        }
        setError(data.error || "Sign-up failed. Try again.");
        return;
      }

      // 2. Account created. Now sign in (with retry for Supabase consistency).
      setInfo("Account created — signing you in…");
      const ok = await signInWithRetry(email.trim(), password);
      if (!ok) {
        // Sign-in failed even after retries. Don't clear the password.
        // Switch to signin mode so the user can click "Sign in" manually.
        setFlow("signin");
        setInfo(
          "Account created, but automatic sign-in timed out. Click \"Sign in\" to continue.",
        );
        return;
      }

      // DEBUG: Same as above — see what cookies the browser has and what
      // the server receives.
      console.log("[signup-debug] After signInWithPassword, document.cookie length:", document.cookie.length);
      console.log("[signup-debug] document.cookie preview:", document.cookie.slice(0, 200));
      try {
        const dbgRes = await fetch("/api/auth/debug-cookies", { credentials: "include" });
        const dbgBody = await dbgRes.json();
        console.log("[signup-debug] Server /api/auth/debug-cookies response:", dbgBody);
      } catch (e) {
        console.log("[signup-debug] debug-cookies fetch failed:", e);
      }

      // 3. Success — redirect.
      router.push(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // --- Phone OTP ---
  async function sendOtp() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setOtpSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: otpCode.trim(),
        type: "sms",
      });
      if (error) {
        setError(error.message);
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // --- OAuth ---
  async function oauth(provider: "google" | "apple") {
    if (busy) return;
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message);
  }

  // Reset the flow when the user wants to edit the email.
  function resetFlow() {
    setFlow(null);
    setPassword("");
    setError(null);
    setInfo(null);
    setTimeout(() => {
      document.getElementById("identifier")?.focus();
    }, 50);
  }

  // Enter key handler for the email input.
  function onEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && email.trim() && !checkingEmail && !busy) {
      e.preventDefault();
      checkEmailAndContinue();
    }
  }

  // Enter key handler for the password input.
  function onPasswordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && password.trim() && !busy && flow) {
      e.preventDefault();
      submitPassword();
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="px-6 pt-8 md:px-12">
        <Link
          href="/"
          className="label-mono uppercase text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back
        </Link>
      </div>

      {/* === TEMP DEBUG PANEL ===
          Shows whether the browser environment can set+read cookies.
          If testCookieWorks=false, cookies are disabled (likely a
          sandboxed iframe) and the auth flow will fail because
          supabase.auth.signInWithPassword can't persist the session. */}
      {envDebug && (
        <div
          className="mx-auto mt-4 max-w-3xl border-2 border-dashed border-amber-500/50 bg-amber-50/50 p-3 font-mono text-xs dark:bg-amber-950/20"
          style={{ whiteSpace: "pre-wrap" }}
        >
          <div className="mb-1 font-bold text-amber-700 dark:text-amber-400">
            [DEBUG] Browser environment
          </div>
          <div>origin: {envDebug.origin}</div>
          <div>isIframe: {String(envDebug.isIframe)}</div>
          <div>navigator.cookieEnabled: {String(envDebug.cookieEnabled)}</div>
          <div>document.cookie length on mount: {envDebug.cookieLengthOnMount}</div>
          <div>
            testCookieWorks:{" "}
            <span
              className={
                envDebug.testCookieWorks ? "text-green-600" : "text-red-600 font-bold"
              }
            >
              {String(envDebug.testCookieWorks)}
            </span>
          </div>
          {envDebug.testCookieWorks === false && (
            <div className="mt-2 text-red-700 dark:text-red-400">
              ⚠ Cookies cannot be set in this browser environment. The Supabase
              session cookie cannot be persisted, so login will fail. This is
              likely because the page is rendered inside a sandboxed iframe.
            </div>
          )}
        </div>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-16 px-6 py-14 md:px-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-24 lg:py-24">
        {/* Left: logo */}
        <div className="flex items-center justify-start">
          <img
            src="/musicosy-logo.png"
            alt="Musicosy"
            className="w-full max-w-[420px] lg:max-w-[560px]"
          />
        </div>

        {/* Right: auth panel */}
        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPhone(!showPhone)}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <PhoneIcon /> Continue with phone
          </button>

          {/* Phone input — slow reveal */}
          <div
            className={`grid transition-all duration-500 ease-in-out ${
              showPhone ? "mt-3 max-h-80 opacity-100" : "mt-0 max-h-0 opacity-0"
            }`}
            style={{ overflow: showPhone ? "visible" : "hidden" }}
          >
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="h-14 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            {!otpSent ? (
              <button
                type="button"
                disabled={!phone.trim() || busy}
                onClick={sendOtp}
                className={`mt-2 flex h-12 items-center justify-center rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90 ${
                  !phone.trim() ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Send code
              </button>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit code"
                  className="mt-2 h-14 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                />
                <button
                  type="button"
                  disabled={otpCode.trim().length < 6 || busy}
                  onClick={verifyOtp}
                  className={`mt-2 flex h-12 items-center justify-center rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90 ${
                    otpCode.trim().length < 6 ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  Verify & continue
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => oauth("google")}
            className="mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-full border border-border bg-background font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => oauth("apple")}
            className="mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-full border border-border bg-background font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            <AppleIcon /> Continue with Apple
          </button>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* === Email + Password section ===
              Single-button flow:
              - flow === null: show email input + "Continue" button
              - flow !== null: show email (read-only with "edit" link) + password input + "Sign in" / "Create account" button
              Never both buttons at the same time. */}

          {/* Email input — always visible. Becomes read-only once flow is set. */}
          <div>
            <label htmlFor="identifier" className="sr-only">
              Email or username
            </label>
            <input
              id="identifier"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Reset flow when email changes after a flow was set.
                if (flow) setFlow(null);
              }}
              onKeyDown={onEmailKeyDown}
              placeholder="Email or username"
              disabled={busy}
              readOnly={!!flow}
              className="h-14 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none disabled:opacity-70"
            />

            {/* If flow is set, show an "edit email" link below the read-only input */}
            {flow && (
              <button
                type="button"
                onClick={resetFlow}
                className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Use a different email
              </button>
            )}
          </div>

          {/* The single primary action button. Label + behavior depend on `flow`. */}
          {!flow ? (
            // No flow yet → "Continue" (check email)
            <button
              type="button"
              disabled={!email.trim() || checkingEmail || busy}
              onClick={checkEmailAndContinue}
              className="mt-4 h-14 w-full rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90 disabled:bg-border disabled:text-muted-foreground"
            >
              {checkingEmail ? "Checking…" : "Continue"}
            </button>
          ) : (
            // Flow is set → password input + "Sign in" / "Create account"
            <div className="mt-4">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onPasswordKeyDown}
                placeholder={flow === "signup" ? "Create a password (min 8 chars)" : "Password"}
                disabled={busy}
                autoFocus
                className="h-14 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none disabled:opacity-70"
              />
              <button
                type="button"
                disabled={!password.trim() || busy}
                onClick={submitPassword}
                className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy
                  ? flow === "signup"
                    ? "Creating account…"
                    : "Signing in…"
                  : flow === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
              {error}
            </p>
          )}

          {info && (
            <p className="mt-4 rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-xs leading-relaxed text-foreground">
              {info}
            </p>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            By continuing, you agree to our{" "}
            <span className="font-semibold text-foreground">Terms of Service</span>,{" "}
            <span className="font-semibold text-foreground">Privacy Policy</span> and{" "}
            <span className="font-semibold text-foreground">Cookie Use</span>.
          </p>
        </div>
      </div>
    </main>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5.6-.9 1-1.8 1.3-2.8-3.3-1.3-2.7-4-2.7-4zM14 4.9c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3.1 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3.1-1.5z" />
    </svg>
  );
}
