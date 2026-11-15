import { describe, expect, it, vi } from "vitest";

vi.stubEnv("MONGODB_URI", "mongodb://localhost/x");
vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(40));
vi.stubEnv("APP_URL", "http://localhost:3000");
const { chooseModel, stripThinking } = await import("@/server/services/groq-models");

describe("Groq model choice", () => {
  it("keeps the configured model when Groq still offers it", () => {
    expect(chooseModel(["a", "llama-3.3-70b-versatile"], "llama-3.3-70b-versatile", "text")).toBe("llama-3.3-70b-versatile");
  });
  it("picks the best available chat model when the configured one is gone", () => {
    const ids = ["whisper-large-v3", "meta-llama/llama-guard-4-12b", "openai/gpt-oss-20b", "openai/gpt-oss-120b", "canopylabs/orpheus-v1"];
    expect(chooseModel(ids, "llama-3.3-70b-versatile", "text")).toBe("openai/gpt-oss-120b");
  });
  it("never picks speech or safety models for chat, and falls back to any chat-like model", () => {
    expect(chooseModel(["whisper-large-v3", "meta-llama/llama-prompt-guard-2-22m", "some/llama-x-70b"], "gone", "text")).toBe("some/llama-x-70b");
  });
  it("finds a vision model by name and uses the configured one if the list cannot be read", () => {
    expect(chooseModel(["openai/gpt-oss-20b", "meta-llama/llama-4-maverick-17b-128e-instruct"], "gone", "vision")).toContain("llama-4");
    expect(chooseModel(null, "my-model", "text")).toBe("my-model");
  });
  it("drops <think> blocks from reasoning models", () => {
    expect(stripThinking("<think>hmm\nlet me see</think>\nAaj 12 bills.")).toBe("Aaj 12 bills.");
  });
});
