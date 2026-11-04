import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const COOKIE = "sb-example-auth-token";
const USER = { id: "user-1", aud: "authenticated", role: "authenticated", email: "t@example.test" };

function encode(part: object): string {
  return Buffer.from(JSON.stringify(part)).toString("base64url");
}

function session(expiresIn: number, token = "first") {
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: USER.id, exp, token })}.signature`,
    refresh_token: `refresh-${token}`,
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: exp,
    user: USER,
  };
}

function request(path: string, cookie?: object): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `${COOKIE}=base64-${encode(cookie)}`;
  return new NextRequest(new URL(path, "http://localhost:5000"), { headers });
}

function answer(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Where the response sends the visitor; null means the page renders. */
function sentTo(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends someone signed out away from the dashboard", async () => {
    expect(sentTo(await proxy(request("/dashboard?tab=teaching")))).toBe("/");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets a session cookie through to the dashboard without asking Supabase", async () => {
    expect(sentTo(await proxy(request("/dashboard", session(3600))))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the landing page to someone signed out, without asking Supabase", async () => {
    expect(sentTo(await proxy(request("/")))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends someone signed in from the landing page to the dashboard", async () => {
    fetchMock.mockResolvedValue(answer(USER));
    expect(sentTo(await proxy(request("/", session(3600))))).toBe("/dashboard");
  });

  it("sends them there from the sign-in card too", async () => {
    fetchMock.mockResolvedValue(answer(USER));
    expect(sentTo(await proxy(request("/?auth=login", session(3600))))).toBe("/dashboard");
  });

  it("carries a renewed session to the browser", async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).includes("/token") ? answer(session(3600, "second")) : answer(USER)
    );
    const response = await proxy(request("/", session(-60)));
    expect(sentTo(response)).toBe("/dashboard");
    expect(response.headers.get("set-cookie")).toContain(COOKIE);
  });

  it("shows the landing page when Supabase rejects the session, so it cannot loop", async () => {
    fetchMock.mockResolvedValue(answer({ code: 403, error_code: "bad_jwt", msg: "invalid JWT" }, 403));
    expect(sentTo(await proxy(request("/", session(3600))))).toBeNull();
  });

  it("shows the landing page when the session has expired and will not renew", async () => {
    fetchMock.mockResolvedValue(answer({ code: 400, error_code: "refresh_token_not_found", msg: "not found" }, 400));
    expect(sentTo(await proxy(request("/", session(-60))))).toBeNull();
  });

  it("shows the landing page when Supabase can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(sentTo(await proxy(request("/", session(3600))))).toBeNull();
  });

  it("stays on the landing page when a page has just sent the visitor here", async () => {
    expect(sentTo(await proxy(request("/?out=1", session(3600))))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the landing page when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(sentTo(await proxy(request("/", session(3600))))).toBeNull();
  });
});
