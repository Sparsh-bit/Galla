// Local development launcher (works in PowerShell, cmd, Git Bash, macOS, Linux): starts the local
// MongoDB replica set and Next.js with safe local defaults.
//
// It always uses the LOCAL database unless MONGODB_URI is set in the shell, so a production
// connection string in .env is never used by accident. Values in .env.local still apply to the rest.
// The server listens on all network interfaces so a phone on the same Wi-Fi can reach it.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { startDb } from "./db.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

/** True when nothing is listening on the port (on any interface). */
const isFree = (p) =>
  new Promise((resolve) => {
    const srv = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => srv.close(() => resolve(true)))
      .listen(Number(p), "0.0.0.0");
  });

// Another dev server (often in a second terminal) may already hold 3000: use the next free port.
const wanted = Number(process.env.PORT || 3000);
let port = String(wanted);
for (let p = wanted; p < wanted + 20; p++) {
  if (await isFree(p)) {
    port = String(p);
    break;
  }
}
if (port !== String(wanted)) console.log(`Port ${wanted} is already in use (is Galla already running in another terminal?). Using ${port} instead.`);

mkdirSync(`${root}/.data`, { recursive: true });
const secretFile = `${root}/.data/dev-secret`;
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(48).toString("base64"));

const mongoUri = process.env.MONGODB_URI || (await startDb().catch((e) => {
  console.error(e.message);
  process.exit(1);
}));

const env = {
  ...process.env,
  MONGODB_URI: mongoUri,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || readFileSync(secretFile, "utf8").trim(),
  APP_URL: process.env.APP_URL || `http://localhost:${port}`,
  MAIL_SINK: process.env.MAIL_SINK || "file",
};

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal && /^(10|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(i.address))
  .map((i) => i.address);
console.log(`\n  Database: ${mongoUri.replace(/\/\/[^@]*@/, "//***@")}`);
console.log(`  This computer:   http://localhost:${port}`);
for (const ip of lan) console.log(`  Phone (same Wi-Fi): http://${ip}:${port}`);
console.log(`  Emails (verification, invites) are written to .data/mail.log\n`);

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, "dev", "--port", port, "--hostname", "0.0.0.0", ...process.argv.slice(2)], { cwd: root, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
