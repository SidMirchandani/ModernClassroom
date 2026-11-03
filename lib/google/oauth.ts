/**
 * Google sign-in for the Classroom connection — the teacher's grant, never a
 * student's. Server-side only: the client secret lives in the environment.
 *
 * Needs a "Web application" OAuth client whose redirect URIs include
 * `<origin>/api/google/callback` for every origin the app runs on.
 */

export const CLASSROOM_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.topics",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials",
];

export const STATE_COOKIE = "mc-google-state";
export const SIGNIN_COOKIE = "mc-google-signin";

/** Signing in needs only who the person is — never their classes. */
export const SIGNIN_SCOPES = ["openid", "email", "profile"];

function credentials() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set");
  return { id, secret };
}

export function redirectUri(origin: string): string {
  return `${origin}/api/google/callback`;
}

export function signInRedirectUri(origin: string): string {
  return `${origin}/api/google/signin/callback`;
}

/**
 * "Continue with Google". Sent from our own address rather than Supabase's,
 * so Google's page names this site, not `….supabase.co`. The nonce goes to
 * Google hashed; its raw form goes to Supabase with the id token, which is
 * how Supabase knows the token was asked for here and not replayed.
 */
export function signInUrl(origin: string, state: string, hashedNonce: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: credentials().id,
    redirect_uri: signInRedirectUri(origin),
    response_type: "code",
    scope: SIGNIN_SCOPES.join(" "),
    prompt: "select_account",
    nonce: hashedNonce,
    state,
  }).toString();
  return url.toString();
}

export function consentUrl(origin: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: credentials().id,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: CLASSROOM_SCOPES.join(" "),
    // A refresh token, every time: the teacher may be reconnecting after
    // disconnecting, and Google only hands one out on a fresh consent.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url.toString();
}

async function tokenRequest(fields: Record<string, string>) {
  const { id, secret } = credentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...fields }),
  });
  const body = await res.json();
  if (!res.ok) throw new GoogleAuthError(body.error ?? `HTTP ${res.status}`);
  return body as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
  };
}

/** Raised when Google refuses a token — usually the teacher revoked access. */
export class GoogleAuthError extends Error {}

export async function exchangeCode(code: string, origin: string) {
  const tokens = await tokenRequest({
    code,
    redirect_uri: redirectUri(origin),
    grant_type: "authorization_code",
  });
  if (!tokens.refresh_token) throw new GoogleAuthError("no refresh token");
  return {
    refreshToken: tokens.refresh_token,
    scopes: tokens.scope ?? "",
    email: emailFromIdToken(tokens.id_token),
  };
}

/** The id token for a sign-in: Supabase turns it into a session. */
export async function exchangeForIdToken(code: string, origin: string): Promise<string> {
  const tokens = await tokenRequest({
    code,
    redirect_uri: signInRedirectUri(origin),
    grant_type: "authorization_code",
  });
  if (!tokens.id_token) throw new GoogleAuthError("no id token");
  return tokens.id_token;
}

export async function accessToken(refreshToken: string): Promise<string> {
  const tokens = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  return tokens.access_token;
}

export async function revoke(refreshToken: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    body: new URLSearchParams({ token: refreshToken }),
  }).catch(() => {});
}

/**
 * The id token came straight from Google's token endpoint over TLS, so its
 * payload is read, not verified — it only labels the connection for display.
 */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
