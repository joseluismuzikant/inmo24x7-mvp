import { describe, expect, it } from "vitest";
import { getSession, resetSession, setSession } from "../../src/services/sessionStore.ts";

describe("sessionStore", () => {
  it("returns default session when user does not exist", () => {
    const session = getSession("new-user");
    expect(session).toEqual({ step: "start" });
  });

  it("stores and retrieves session", () => {
    setSession("u1", { step: "ask_budget", data: { zona: "Palermo" } } as any);
    expect(getSession("u1")).toEqual({ step: "ask_budget", data: { zona: "Palermo" } });
  });

  it("resets session for a user", () => {
    setSession("u2", { step: "show_results" } as any);
    resetSession("u2");
    expect(getSession("u2")).toEqual({ step: "start" });
  });
});
