// Regenerates the endpoint tables in docs/API.md from the shared route list (src/lib/api/routes.ts),
// so the docs can never disagree with the server. `npm run api:docs` writes, `--check` fails on drift (CI).
import { readFileSync, writeFileSync } from "node:fs";
import { API_ROUTES, type RouteName, type RouteSpec } from "../src/lib/api/routes";

const SECTIONS: [string, string[]][] = [
  ["Auth & account (Better Auth's own endpoints live under /api/auth/*)", ["auth", "account", "invitations", "me"]],
  ["Businesses", ["businesses"]],
  ["Dashboard & reports", ["dashboard", "reports"]],
  ["Products", ["products", "variants", "categories", "taxRates", "locations"]],
  ["Inventory", ["stock", "serials"]],
  ["Point of sale & sales", ["sales", "heldBills", "pos", "scanSessions"]],
  ["Customers, suppliers, khata", ["customers", "suppliers", "parties", "ledger", "khata"]],
  ["Purchases", ["purchases", "purchaseBills"]],
  ["Settings, team, audit, import", ["settings", "members", "audit", "imports"]],
];

const names = Object.keys(API_ROUTES) as RouteName[];
const group = (n: string) => n.split(".")[0];
const missing = names.filter((n) => !SECTIONS.some(([, g]) => g.includes(group(n))));
if (missing.length) throw new Error(`Add a docs section for: ${missing.join(", ")}`);

const esc = (s: string) => s.replace(/\|/g, "\\|");
let out = "## Endpoints\n\nGenerated from `src/lib/api/routes.ts` by `npm run api:docs`. The name column is what the apps call (`api.call(\"sales.refund\", …)`).\n";
for (const [title, groups] of SECTIONS) {
  out += `\n### ${title}\n\n| Method | Path | Name | What it does |\n|---|---|---|---|\n`;
  for (const n of names.filter((x) => groups.includes(group(x)))) {
    const r = API_ROUTES[n] as RouteSpec;
    out += `| \`${r.method}\` | \`/api/v1${r.path}\` | \`${n}\` | ${esc(r.summary)}${r.public ? " _(no sign-in)_" : ""} |\n`;
  }
}

const file = new URL("../docs/API.md", import.meta.url);
const current = readFileSync(file, "utf8");
const start = current.indexOf("## Endpoints");
if (start < 0) throw new Error("docs/API.md has no '## Endpoints' heading");
const next = current.slice(0, start) + out;
if (process.argv.includes("--check")) {
  if (next !== current) {
    console.error("docs/API.md is out of date. Run: npm run api:docs");
    process.exit(1);
  }
  console.log("docs/API.md is up to date");
} else {
  writeFileSync(file, next);
  console.log("docs/API.md updated");
}
