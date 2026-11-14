// Starts a local single-node MongoDB replica set (transactions need a replica set).
// Cross-platform (Windows PowerShell, macOS, Linux). Needs `mongod` and `mongosh` on PATH.
// Data lives in .data/db; the log in .data/mongod.log.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
let PORT = process.env.MONGO_PORT || "27017";

function mongosh(evalJs, port = PORT) {
  const r = spawnSync("mongosh", ["--quiet", "--port", port, "--eval", evalJs], { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), missing: r.error?.code === "ENOENT" || /not recognized|not found/i.test(r.stderr || "") };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startDb() {
  // A plain MongoDB (e.g. the Windows "MongoDB" service) on 27017 can't do transactions; use 27018 for Galla.
  if (!process.env.MONGO_PORT) {
    const probe = mongosh("(() => { try { return String(rs.status().ok) } catch (e) { return String(e.codeName) } })()");
    if (/NoReplicationEnabled/.test(probe.out)) {
      PORT = "27018";
      console.log("Port 27017 has a MongoDB without replica set support (Windows service); using 27018 for Galla.");
    }
  }
  const first = mongosh("db.runCommand({ping:1}).ok");
  if (first.missing) throw new Error("mongosh was not found. Install MongoDB Shell (https://www.mongodb.com/try/download/shell) and reopen the terminal.");
  if (!first.ok) {
    mkdirSync(`${root}/.data/db`, { recursive: true });
    const log = openSync(`${root}/.data/mongod.log`, "a");
    const child = spawn("mongod", ["--dbpath", `${root}/.data/db`, "--replSet", "rs0", "--port", PORT, "--bind_ip", "127.0.0.1"], {
      detached: true, stdio: ["ignore", log, log], windowsHide: true,
    });
    child.on("error", (e) => {
      console.error(e.code === "ENOENT" ? "mongod was not found. Install MongoDB Community Server and add its bin folder to PATH." : e.message);
      process.exit(1);
    });
    child.unref();
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      await sleep(500);
      up = mongosh("db.runCommand({ping:1}).ok").ok;
    }
    if (!up) throw new Error(`MongoDB didn't start on port ${PORT}. See .data/mongod.log`);
  }
  mongosh(`try { rs.status().ok } catch (e) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:${PORT}" }] }) }`);
  // Wait until this node is primary (needed for transactions).
  for (let i = 0; i < 40; i++) {
    if (mongosh("db.hello().isWritablePrimary").out === "true") break;
    await sleep(500);
  }
  return `mongodb://127.0.0.1:${PORT}/galla?replicaSet=rs0`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startDb()
    .then((uri) => console.log(`MongoDB replica set rs0 running: ${uri}`))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
