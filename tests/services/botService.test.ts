import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "../../src/services/sessionStore.ts";

const { openaiCreateMock, hasToolCallsMock, parseToolCallsMock, executeToolCallsMock, leadServiceMock } = vi.hoisted(() => ({
  openaiCreateMock: vi.fn(),
  hasToolCallsMock: vi.fn(),
  parseToolCallsMock: vi.fn(),
  executeToolCallsMock: vi.fn(),
  leadServiceMock: {
    loadOrCreateLead: vi.fn(),
  },
}));

vi.mock("../../src/services/openaiClient.js", () => ({
  openai: {
    chat: {
      completions: {
        create: openaiCreateMock,
      },
    },
  },
}));

vi.mock("../../src/services/toolParser.js", () => ({
  hasToolCalls: hasToolCallsMock,
  parseToolCalls: parseToolCallsMock,
}));

vi.mock("../../src/services/toolHandler.js", () => ({
  executeToolCalls: executeToolCallsMock,
}));

vi.mock("../../src/services/leadService.js", () => ({
  leadService: leadServiceMock,
}));

import { botReply } from "../../src/services/botService.ts";

describe("botService", () => {
  beforeEach(() => {
    resetSession("bot-user");
    leadServiceMock.loadOrCreateLead.mockResolvedValue(undefined);
    hasToolCallsMock.mockReturnValue(false);
    parseToolCallsMock.mockReturnValue([]);
    executeToolCallsMock.mockResolvedValue({ results: [] });
  });

  it("handles reset commands without calling OpenAI", async () => {
    const response = await botReply({
      userId: "bot-user",
      text: "reset",
      tenantId: "tenant-1",
      sourceType: "web_chat",
    });

    expect(response.messages[0]).toContain("Reinicié la conversación");
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("returns OpenAI final response when no tools are used", async () => {
    openaiCreateMock
      .mockResolvedValueOnce({ choices: [{ message: { content: "Primera" } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: "Respuesta final" } }] });

    const response = await botReply({
      userId: "bot-user",
      text: "Hola",
      tenantId: "tenant-1",
      sourceType: "web_chat",
    });

    expect(openaiCreateMock).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ messages: ["Respuesta final"], handoff: undefined });
  });

  it("returns graceful error message when OpenAI fails", async () => {
    openaiCreateMock.mockRejectedValue(new Error("boom"));

    const response = await botReply({
      userId: "bot-user",
      text: "hola",
      tenantId: "tenant-1",
      sourceType: "whatsapp",
    });

    expect(response.messages[0]).toContain("hubo un error procesando tu mensaje");
  });
});
