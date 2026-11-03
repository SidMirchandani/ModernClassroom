// M1 spike: does the Classroom API publish a scheduled draft on its own?
//
// Throwaway, and deliberately outside the app. It answers one question from
// docs/adapt/adapt-04-prototype.md — the riskiest assumption behind ADR-006 —
// before any app code depends on the answer. The reference says
// `scheduledTime` is writable on create and patch; this proves it on a real
// class.
//
// Run against a personal-Gmail test class, never a school account:
//
//   node --env-file=.env.local scripts/spike-classroom.mjs courses
//   node --env-file=.env.local scripts/spike-classroom.mjs create <courseId> [minutes]
//   node --env-file=.env.local scripts/spike-classroom.mjs check
//   node --env-file=.env.local scripts/spike-classroom.mjs cleanup
//
// Needs a "Desktop app" OAuth client from Google Cloud in .env.local:
//   SPIKE_GOOGLE_CLIENT_ID=...   SPIKE_GOOGLE_CLIENT_SECRET=...
//
// The first run opens Google's consent page and listens on 127.0.0.1 for the
// redirect. The refresh token and the created item's id are kept in
// .spike-classroom.json (gitignored), so `check` needs no second sign-in.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { exec } from "node:child_process";

const STATE_FILE = ".spike-classroom.json";
const API = "https://classroom.googleapis.com/v1";
const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students",
];

const { SPIKE_GOOGLE_CLIENT_ID: clientId, SPIKE_GOOGLE_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error("Set SPIKE_GOOGLE_CLIENT_ID and SPIKE_GOOGLE_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}

function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Loopback OAuth: Google redirects the browser to a one-shot local server.
async function signIn() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const redirectUri = `http://127.0.0.1:${server.address().port}`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  }).toString();

  console.log(`\nSign in with your PERSONAL test Gmail:\n${url}\n`);
  exec(`${process.platform === "win32" ? "start \"\"" : "open"} "${url}"`);

  const code = await new Promise((resolve, reject) => {
    server.on("request", (req, res) => {
      const params = new URL(req.url, redirectUri).searchParams;
      res.end(params.get("code") ? "Signed in. You can close this tab." : "Sign-in failed.");
      server.close();
      params.get("code") ? resolve(params.get("code")) : reject(new Error(params.get("error") ?? "no code"));
    });
  });

  const tokens = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!tokens.refresh_token) throw new Error("Google returned no refresh token.");
  return tokens;
}

async function tokenRequest(fields) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token request failed: ${JSON.stringify(body)}`);
  return body;
}

async function accessToken(state) {
  if (!state.refreshToken) {
    state.refreshToken = (await signIn()).refresh_token;
    saveState(state);
  }
  const tokens = await tokenRequest({ refresh_token: state.refreshToken, grant_type: "refresh_token" });
  return tokens.access_token;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}\n${JSON.stringify(json, null, 2)}`);
  return json;
}

const [command, ...args] = process.argv.slice(2);
const state = loadState();

if (command === "courses") {
  const token = await accessToken(state);
  const { courses = [] } = await api(token, "GET", "/courses?teacherId=me&courseStates=ACTIVE");
  if (!courses.length) console.log("No active classes you teach. Create one at classroom.google.com.");
  for (const c of courses) console.log(`${c.id}  ${c.name}`);
} else if (command === "create") {
  const [courseId, minutes = "5"] = args;
  if (!courseId) throw new Error("Usage: create <courseId> [minutes]");
  const token = await accessToken(state);
  const scheduledTime = new Date(Date.now() + Number(minutes) * 60_000).toISOString();

  const item = await api(token, "POST", `/courses/${courseId}/courseWork`, {
    title: "Spike: scheduled post",
    description: "Created by the Modern Classroom M1 spike. Safe to delete.",
    workType: "ASSIGNMENT",
    state: "DRAFT",
    scheduledTime,
  });

  state.courseId = courseId;
  state.courseWorkId = item.id;
  state.requestedTime = scheduledTime;
  saveState(state);

  console.log(`Created ${item.id}`);
  console.log(`  state:         ${item.state}`);
  console.log(`  scheduledTime: ${item.scheduledTime ?? "(not returned — Google ignored it)"}`);
  console.log(`  requested:     ${scheduledTime}`);
  console.log(`\nRun "check" after ${new Date(scheduledTime).toLocaleTimeString()}.`);
} else if (command === "check") {
  if (!state.courseWorkId) throw new Error('Nothing created yet. Run "create" first.');
  const token = await accessToken(state);
  const item = await api(token, "GET", `/courses/${state.courseId}/courseWork/${state.courseWorkId}`);
  const due = new Date(state.requestedTime) <= new Date();

  console.log(`state:         ${item.state}`);
  console.log(`scheduledTime: ${item.scheduledTime ?? "(none)"}`);
  console.log(`requested:     ${state.requestedTime}`);
  if (item.state === "PUBLISHED") console.log("\nPASS — Classroom published the scheduled draft on its own.");
  else if (!due) console.log("\nNot due yet. Check again after the requested time.");
  else console.log("\nFAIL so far — past the requested time and still not published. Give it a few minutes, then fall back to the daily job (ADR-006).");
} else if (command === "cleanup") {
  if (state.courseWorkId) {
    const token = await accessToken(state);
    await api(token, "DELETE", `/courses/${state.courseId}/courseWork/${state.courseWorkId}`);
    console.log(`Deleted ${state.courseWorkId}.`);
  }
  rmSync(STATE_FILE, { force: true });
  console.log(`Removed ${STATE_FILE}.`);
} else {
  console.log("Commands: courses · create <courseId> [minutes] · check · cleanup");
}
