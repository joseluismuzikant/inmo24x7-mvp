import { describe, expect, it } from "vitest";
import {
  getLeadIdFromParams,
  getTenantId,
  requireLeadId,
  requireTenantId,
} from "../../src/services/userService.ts";

describe("userService", () => {
  it("returns tenant id when present", () => {
    const req = { user: { tenant_id: "tenant-1" } } as any;
    expect(getTenantId(req)).toBe("tenant-1");
  });

  it("returns null tenant id when missing", () => {
    const req = {} as any;
    expect(getTenantId(req)).toBeNull();
  });

  it("parses lead id from params", () => {
    const req = { params: { id: "12" } } as any;
    expect(getLeadIdFromParams(req)).toBe(12);
  });

  it("returns null lead id for invalid value", () => {
    const req = { params: { id: "abc" } } as any;
    expect(getLeadIdFromParams(req)).toBeNull();
  });

  it("throws when tenant id is required but missing", () => {
    const req = {} as any;
    expect(() => requireTenantId(req)).toThrow("Unauthorized - No tenant_id");
  });

  it("throws when lead id is required but invalid", () => {
    const req = { params: { id: "0" } } as any;
    expect(() => requireLeadId(req)).toThrow("Invalid lead ID");
  });
});
