import { describe, expect, it, vi } from "vitest";

const { OpenAIMock } = vi.hoisted(() => ({
  OpenAIMock: vi.fn().mockImplementation((opts: unknown) => ({ opts })),
}));

vi.mock("openai", () => ({
  default: OpenAIMock,
}));

describe("openaiClient", () => {
  it("creates OpenAI instance with OPENAI_API_KEY", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    vi.resetModules();

    const mod = await import("../../src/services/openaiClient.ts");

    expect(OpenAIMock).toHaveBeenCalledWith({ apiKey: "test-openai-key" });
    expect(mod.openai).toBeDefined();
  });
});
