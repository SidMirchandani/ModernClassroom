// A production build that cannot disturb a running dev server.
//
// `next dev` and `next build` both write to `.next`, and rebuilding it under a
// live dev server leaves it serving a bare "Internal Server Error" until it is
// restarted — which looks like an app bug and is not one. This points the
// build at `.next-build` instead.
//
// It exists as a script rather than an inline env var because npm runs scripts
// through cmd.exe on Windows, where `VAR=value next build` is a syntax error.

import { spawn } from "node:child_process";

const child = spawn("next", ["build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-build" },
});

child.on("exit", (code) => process.exit(code ?? 1));
