import { describe, expect, it } from "vitest";
import {
  addMessageToHistory,
  canCreateLead,
  ensureLeadData,
  getHistory,
  getLeadId,
  setLeadId,
} from "../../src/services/sessionService.ts";

describe("sessionService", () => {
  it("initializes lead data if missing", () => {
    const session: any = { step: "start" };
    const data = ensureLeadData(session);
    expect(data).toEqual({});
    expect(session.data).toEqual({});
  });

  it("stores and reads lead id", () => {
    const session: any = { step: "start" };
    expect(getLeadId(session)).toBeUndefined();
    setLeadId(session, 55);
    expect(getLeadId(session)).toBe(55);
  });

  it("keeps only last 10 history messages", () => {
    const session: any = { step: "start" };
    for (let i = 1; i <= 12; i += 1) {
      addMessageToHistory(session, { role: "user", content: `msg-${i}` });
    }
    const history = getHistory(session);
    expect(history).toHaveLength(10);
    expect(history[0].content).toBe("msg-3");
    expect(history[9].content).toBe("msg-12");
  });

  it("validates lead creation criteria", () => {
    expect(
      canCreateLead({
        operacion: "venta",
        zona: "Belgrano",
        presupuestoMax: 100000,
      })
    ).toBe(true);

    expect(canCreateLead({ operacion: "venta", zona: "Belgrano", presupuestoMax: 0 })).toBe(false);
    expect(canCreateLead({ zona: "Belgrano", presupuestoMax: 100000 })).toBe(false);
  });
});
