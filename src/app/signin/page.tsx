"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

/**
 * Musicosy sign-in / sign-up.
 *
 * Behavior (per spec): the form queries Supabase to check if the email
 * exists BEFORE showing the password field. If the email is registered,
 * the password form runs sign-in. If it isn't, the password form runs
 * sign-up. The user never has to enter wrong credentials to discover
 * which flow they're in.
 *
 * Phone / Google / Apple buttons match the reference design from
 * landing-home. They will show Supabase's native error if a provider
 * isn't enabled — no custom handling, no extra UI added.
 *
 * `next` query param is set by middleware when redirecting from /dashboard/*.
 */
export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const supabase = createBrowserClient();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  // flow is set after the email "Continue" click — drives button label + behavior
  const [flow, setFlow] = useState<"signin" | "signup" | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finish() {
    startTransition(() => {
      router.refresh();
      router.replace(next);
    });
  }

  // --- Check email → set flow ---
  async function checkEmailAndContinue() {
    setError(null);
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
    } catch {
      setError("Network error. Try again.");
    } finally {
      setCheckingEmail(false);
    }
  }

  // --- Submit password (sign-in or sign-up based on flow) ---
  async function submitPassword() {
    setError(null);

    if (flow === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      finish();
      return;
    }

    // flow === "signup"
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is off, signUp returns a session — done
    if (data.session) {
      finish();
      return;
    }
    // Email confirmation is on — Supabase requires verification before login
    setError(
      `Account created. Check your inbox at ${email.trim()} for a confirmation link, ` +
      `then sign in. (To disable this requirement in dev: Supabase Dashboard → ` +
      `Authentication → Sign In / Up → turn off "Confirm email".)`,
    );
  }

  // --- Phone OTP ---
  async function sendOtp() {
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.trim(),
      options: { shouldCreateUser: true },
    });
    if (error) {
      setError(error.message);
      return;
    }
    setOtpSent(true);
  }

  async function verifyOtp() {
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: otpCode.trim(),
      type: "sms",
    });
    if (error) {
      setError(error.message);
      return;
    }
    finish();
  }

  // --- OAuth ---
  async function oauth(provider: "google" | "apple") {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message);
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
            disabled={pending}
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
                disabled={!phone.trim() || pending}
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
                  disabled={otpCode.trim().length < 6 || pending}
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
            disabled={pending}
            onClick={() => oauth("google")}
            className="mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-full border border-border bg-background font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <button
            type="button"
            disabled={pending}
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

          {/* Email input */}
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
                // Reset flow when email changes — need to re-check before submit
                if (flow) setFlow(null);
              }}
              placeholder="Email or username"
              className="h-14 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <button
              type="button"
              disabled={!email.trim() || checkingEmail || pending}
              onClick={checkEmailAndContinue}
              className="mt-4 h-14 w-full rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90 disabled:bg-border disabled:text-muted-foreground"
            >
              {checkingEmail ? "Checking…" : "Continue"}
            </button>
          </div>

          {/* Password — slow reveal after email check resolves the flow */}
          <div
            className={`grid transition-all duration-500 ease-in-out ${
              flow ? "mt-4 max-h-40 opacity-100" : "mt-0 max-h-0 opacity-0"
            }`}
            style={{ overflow: flow ? "visible" : "hidden" }}
          >
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={flow === "signup" ? "Create a password" : "Password"}
              className="h-14 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <button
              type="button"
              disabled={!password.trim() || pending}
              onClick={submitPassword}
              className={`mt-3 flex h-14 items-center justify-center rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90 ${
                !password.trim() ? "pointer-events-none opacity-40" : ""
              }`}
            >
              {flow === "signup" ? "Create account" : "Sign in"}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
              {error}
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
