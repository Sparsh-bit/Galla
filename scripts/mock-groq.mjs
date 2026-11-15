// A stand-in for the Groq API, used by the end-to-end tests: lists one chat model, answers the assistant
// with a fixed line, and answers the menu reader by turning "item  price" lines of the OCR text into items.
import http from "node:http";

export function startMockGroq(port) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (o, status = 200) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(o));
      };
      if (req.url?.endsWith("/models")) return send({ data: [{ id: "openai/gpt-oss-120b" }, { id: "whisper-large-v3" }] });
      if (req.url?.endsWith("/chat/completions")) {
        const msgs = JSON.parse(body || "{}").messages ?? [];
        const first = String(msgs[0]?.content ?? "");
        if (first.includes("LIVE DATA")) return send({ choices: [{ message: { content: "MOCK-ASSISTANT-REPLY" } }] });
        const text = first.split('Photo text:\n"""\n')[1]?.split('\n"""')[0] ?? first.split('Document text:\n"""\n')[1]?.split('\n"""')[0] ?? "";
        const items = [];
        for (const line of text.split("\n")) {
          const m = /^(.*?)[\s|.]+(?:rs\.?\s*)?(\d{1,5})(?:\/-)?$/i.exec(line.trim());
          if (!m) continue;
          const half = /\b(half|full)\b/i.exec(m[1]);
          items.push({ name: m[1].replace(/\s+(half|full)\b/i, "").trim(), variant: half ? half[1] : "", category: "", unit: "pcs", price: Number(m[2]), cost: null, tax_percent: null });
        }
        return send({ choices: [{ message: { content: JSON.stringify({ items, note: "" }) } }] });
      }
      send({ error: "not found" }, 404);
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ close: () => server.close() })));
}
