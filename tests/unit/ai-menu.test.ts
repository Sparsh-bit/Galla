import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GROQ_API_KEY;
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load(key: string | null, groq: string | null = null) {
  Object.assign(process.env, { MONGODB_URI: "mongodb://localhost/x", BETTER_AUTH_SECRET: "x".repeat(40), APP_URL: "http://localhost:3000" });
  if (key) process.env.ANTHROPIC_API_KEY = key;
  if (groq) process.env.GROQ_API_KEY = groq;
  return import("@/server/services/ai-menu");
}
const png = () => sharp({ create: { width: 40, height: 40, channels: 3, background: "#fff" } }).png().toBuffer();
const reply = (input: unknown) => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "tool_use", input }] }) });

describe("AI menu reader", () => {
  it("is off without a key, with a clear message", async () => {
    const { readMenu } = await load(null);
    await expect(readMenu(await png(), "image/png")).rejects.toThrow(/not switched on/);
  });

  it("turns a menu with no cost prices into draft rows", async () => {
    const { readMenu } = await load("sk-ant-test");
    const fetchMock = vi.fn(async () => reply({
      note: "",
      items: [
        { name: " Paneer Tikka ", variant: "Half", category: "Starters", unit: "pcs", price: 180, cost: null, tax_percent: null },
        { name: "Paneer Tikka", variant: "Full", category: "Starters", unit: "pcs", price: 320.5, cost: null, tax_percent: 5 },
        { name: "Masala Chai", variant: "", category: "Beverages", unit: "cup-of-tea", price: null, cost: null, tax_percent: null },
        { name: "", variant: "", category: "", unit: "pcs", price: 10, cost: null, tax_percent: null },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { rows } = await readMenu(await png(), "image/png");
    expect(rows).toEqual([
      { name: "Paneer Tikka", variant: "Half", category: "Starters", unit: "pcs", price: "180", cost: "", tax_rate: "" },
      { name: "Paneer Tikka", variant: "Full", category: "Starters", unit: "pcs", price: "320.5", cost: "", tax_rate: "5" },
      { name: "Masala Chai", variant: "", category: "Beverages", unit: "pcs", price: "", cost: "", tax_rate: "" }, // unknown unit -> pcs; no price stays empty for the owner to fill
    ]);
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.messages[0].content[0].type).toBe("image"); // photos go as images, PDFs as documents
  });

  it("sends PDFs as documents and refuses fake PDFs", async () => {
    const { readMenu } = await load("sk-ant-test");
    const fetchMock = vi.fn(async () => reply({ items: [], note: "" }));
    vi.stubGlobal("fetch", fetchMock);
    await readMenu(Buffer.from("%PDF-1.4 test"), "application/pdf");
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body).messages[0].content[0].type).toBe("document");
    await expect(readMenu(Buffer.from("not a pdf"), "application/pdf")).rejects.toThrow(/not a valid PDF/);
  });

  it("explains a busy or failing service without leaking details", async () => {
    const { readMenu } = await load("sk-ant-test");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, text: async () => "secret detail" })));
    await expect(readMenu(await png(), "image/png")).rejects.toThrow(/busy/);
  });

  it("uses Groq when its key is set: photos go to the vision model, nothing is trusted blindly", async () => {
    const { readMenu } = await load(null, "gsk_test");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [{ name: "Veg Burger", variant: "", category: "Snacks", unit: "pcs", price: 89, cost: null, tax_percent: null }, { name: "Rice Bag", unit: "weird", price: -5 }], note: "" }) } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { rows } = await readMenu(await png(), "image/png");
    const [url, init] = (fetchMock.mock.calls as unknown as [string, { headers: Record<string, string>; body: string }][]).find((c) => String(c[0]).includes("chat/completions"))!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer gsk_test");
    const body = JSON.parse(init.body);
    expect(body.model).toMatch(/llama-4/);
    expect(body.messages[0].content[1].type).toBe("image_url");
    expect(rows[0]).toEqual({ name: "Veg Burger", variant: "", category: "Snacks", unit: "pcs", price: "89", cost: "", tax_rate: "" });
    expect(rows[1].price).toBe(""); // a negative price is dropped for the owner to fill in
    expect(rows[1].unit).toBe("pcs");
  });

  it("reads a text PDF with the Groq text model and explains a scanned PDF", async () => {
    const { readMenu } = await load(null, "gsk_test");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{\"items\":[],\"note\":\"\"}" } }] }) })));
    await expect(readMenu(Buffer.from("%PDF-1.4 garbage"), "application/pdf")).rejects.toThrow(/could not be read|scanned/);
  });

  it("reads a photo with the built-in text reader when the AI account has no vision model", async () => {
    vi.doMock("@/server/services/ocr", () => ({ ocrImage: async () => "SHARMA CAFE\nPaneer Tikka Half 180\nMasala Chai 25" }));
    const { readMenu } = await load(null, "gsk_test");
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes("/models")
        ? { ok: true, status: 200, json: async () => ({ data: [{ id: "openai/gpt-oss-120b" }, { id: "whisper-large-v3" }] }) }
        : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [{ name: "Masala Chai", variant: "", category: "", unit: "pcs", price: 25, cost: null, tax_percent: null }], note: "" }) } }] }) },
    );
    vi.stubGlobal("fetch", fetchMock);
    const { rows } = await readMenu(await png(), "image/png");
    expect(rows).toEqual([{ name: "Masala Chai", variant: "", category: "", unit: "pcs", price: "25", cost: "", tax_rate: "" }]);
    const chat = (fetchMock.mock.calls as unknown as [string, { body: string }][]).find((c) => String(c[0]).includes("chat/completions"))!;
    const body = JSON.parse(chat[1].body);
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(typeof body.messages[0].content).toBe("string"); // text only: no image sent
    expect(body.messages[0].content).toContain("Paneer Tikka Half 180");
    vi.doUnmock("@/server/services/ocr");
  });

  it("explains a photo with no readable text", async () => {
    vi.doMock("@/server/services/ocr", () => ({ ocrImage: async () => "  " }));
    const { readMenu } = await load(null, "gsk_test");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/models") ? { ok: true, status: 200, json: async () => ({ data: [{ id: "openai/gpt-oss-120b" }] }) } : { ok: true, status: 200, json: async () => ({}) })));
    await expect(readMenu(await png(), "image/png")).rejects.toThrow(/No readable text/);
    vi.doUnmock("@/server/services/ocr");
  });

  it("retries without JSON mode when the model rejects it, and reads JSON wrapped in text", async () => {
    vi.doMock("@/server/services/ocr", () => ({ ocrImage: async () => "Masala Chai 25\nCold Coffee 90" }));
    const { readMenu } = await load(null, "gsk_test");
    let chatCalls = 0;
    const fetchMock = vi.fn(async (url: string, init?: { body: string }) => {
      if (String(url).includes("/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "openai/gpt-oss-120b" }] }) };
      chatCalls++;
      if (JSON.parse(init!.body).response_format) return { ok: false, status: 400, text: async () => "response_format json_object is not supported by this model" };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Here you go:\n```json\n{"items":[{"name":"Masala Chai","variant":"","category":"","unit":"pcs","price":"₹25","cost":null,"tax_percent":null}],"note":""}\n```' } }] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rows } = await readMenu(await png(), "image/png");
    expect(chatCalls).toBe(2);
    expect(rows).toEqual([{ name: "Masala Chai", variant: "", category: "", unit: "pcs", price: "25", cost: "", tax_rate: "" }]); // "₹25" text becomes 25
    vi.doUnmock("@/server/services/ocr");
  });

  it("never offers lines that are not a real product name", async () => {
    const { looksLikeProductName } = await import("@/lib/ai-menu");
    for (const junk of ["", "x", "0oood", "|| --", "1234567", "....", "aaaa", "12 34 56", "₹ 180"]) expect(looksLikeProductName(junk), junk).toBe(false);
    for (const ok of ["Tea", "Paneer Tikka", "Masala Chai 250ml", "चाय", "7Up", "Pepsi 2L"]) expect(looksLikeProductName(ok), ok).toBe(true);
    const { readMenu } = await load("sk-ant-test");
    vi.stubGlobal("fetch", vi.fn(async () => reply({ note: "", items: [{ name: "0oood", variant: "", category: "", unit: "pcs", price: 5, cost: null, tax_percent: null }, { name: "Tea", variant: "", category: "", unit: "pcs", price: 10, cost: null, tax_percent: null }] })));
    const { rows } = await readMenu(await png(), "image/png");
    expect(rows.map((r) => r.name)).toEqual(["Tea"]);
  });
});
