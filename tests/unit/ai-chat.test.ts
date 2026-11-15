import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/reports", () => ({
  startOfDay: () => new Date("2026-11-14T00:00:00Z"),
  salesTotals: async () => ({ revenue: 1234500, count: 12, avgBill: 102875, returns: 0, net: 1234500, creditGiven: 50000, grossProfit: 300000 }),
  salesByProduct: async () => [],
  lowStock: async () => [],
  balances: async () => ({ rows: [], total: 0 }),
  expiringBatches: async () => [],
}));
vi.mock("@/server/services/products", () => ({ searchVariants: async () => [] }));
vi.mock("@/server/models", () => ({ Types: { ObjectId: class {} }, StockLevel: { aggregate: async () => [] } }));
vi.mock("@/server/context", () => {
  class AppError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return {
    AppError,
    allowed: (ctx: { role: string }, p: string) => ctx.role === "owner" || !["reports:read"].includes(p),
    getOrgSettings: async () => ({ currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata" }),
  };
});

afterEach(() => {
  delete process.env.GROQ_API_KEY;
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load(withKey = true) {
  Object.assign(process.env, { MONGODB_URI: "mongodb://localhost/x", BETTER_AUTH_SECRET: "x".repeat(40), APP_URL: "http://localhost:3000" });
  if (withKey) process.env.GROQ_API_KEY = "gsk_test";
  return import("@/server/services/ai-chat");
}
const ctx = (role = "owner") => ({ orgId: "a".repeat(24), orgName: "Sharma Kirana", role }) as never;

describe("Ask Galla", () => {
  it("is off without a key", async () => {
    const { chatReply } = await load(false);
    await expect(chatReply(ctx(), [{ role: "user", content: "hi" }])).rejects.toThrow(/not switched on/);
  });

  it("answers from live shop data in one call, no tool calling", async () => {
    const { chatReply } = await load();
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Aaj ₹12,345 ki bikri hui, 12 bills." } }] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await chatReply(ctx(), [{ role: "user", content: "aaj kitni sale hui?" }]);
    expect(out).toBe("Aaj ₹12,345 ki bikri hui, 12 bills.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.tools).toBeUndefined();
    const system = body.messages[0].content as string;
    expect(system).toContain("Sharma Kirana");
    expect(system).toMatch(/only read/);
    const data = JSON.parse(system.slice(system.indexOf("LIVE DATA (JSON, amounts are formatted money):\n") + "LIVE DATA (JSON, amounts are formatted money):\n".length));
    expect(data.sales_today).toMatchObject({ bills: 12, revenue: "₹12,345.00", profit: "₹3,000.00" });
  });

  it("keeps money data away from roles without access", async () => {
    const { chatReply } = await load();
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "ok" } }] }) }));
    vi.stubGlobal("fetch", fetchMock);
    await chatReply(ctx("cashier"), [{ role: "user", content: "who owes money?" }]);
    const system = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body).messages[0].content as string;
    expect(system).toContain("not allowed"); // the dues section says the role may not see it
    expect(system).not.toContain("profit");
  });

  it("tells the operator what is wrong, not a vague failure", async () => {
    const { chatReply } = await load();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, text: async () => "bad key" })));
    await expect(chatReply(ctx(), [{ role: "user", content: "x" }])).rejects.toThrow(/GROQ_API_KEY/);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, text: async () => "model gone" })));
    await expect(chatReply(ctx(), [{ role: "user", content: "x" }])).rejects.toThrow(/GROQ_TEXT_MODEL/);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, text: async () => "slow down" })));
    await expect(chatReply(ctx(), [{ role: "user", content: "x" }])).rejects.toThrow(/busy/);
  });
});
