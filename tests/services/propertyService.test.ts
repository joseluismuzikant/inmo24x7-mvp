import { afterEach, describe, expect, it, vi } from "vitest";

const { loadPropertiesFromCSVMock, loadPropertiesFromJsonMock, searchPropertiesInSupabaseMock } = vi.hoisted(() => ({
  loadPropertiesFromCSVMock: vi.fn(),
  loadPropertiesFromJsonMock: vi.fn(),
  searchPropertiesInSupabaseMock: vi.fn(),
}));

vi.mock("../../src/services/propertyLoader.js", () => ({
  loadPropertiesFromCSV: loadPropertiesFromCSVMock,
  loadPropertiesFromJson: loadPropertiesFromJsonMock,
}));

vi.mock("../../src/repositories/propertyRepo.js", () => ({
  loadPropertiesDB: vi.fn(),
  searchPropertiesInSupabase: searchPropertiesInSupabaseMock,
}));

import { searchProperties } from "../../src/services/propertyService.ts";

describe("propertyService", () => {
  afterEach(() => {
    delete process.env.PROPERTY_LOADER;
  });

  it("uses CSV loader by default and filters by availability, operation and zone", async () => {
    loadPropertiesFromCSVMock.mockResolvedValue([
      { id: "1", operacion: "alquiler", zona: "Palermo Soho", precio: 200000, disponible: true, titulo: "A" },
      { id: "2", operacion: "alquiler", zona: "Palermo", precio: 100000, disponible: false, titulo: "B" },
      { id: "3", operacion: "venta", zona: "Palermo", precio: 300000, disponible: true, titulo: "C" },
    ]);

    const result = await searchProperties({
      tenant_id: "t1",
      operacion: "alquiler",
      zona: "palermo",
      presupuestoMax: 250000,
    });

    expect(loadPropertiesFromCSVMock).toHaveBeenCalledTimes(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe("1");
    expect(result.propertiesWithinBudget).toBe(1);
  });

  it("uses JSON loader when PROPERTY_LOADER=json", async () => {
    process.env.PROPERTY_LOADER = "json";
    loadPropertiesFromJsonMock.mockResolvedValue([
      { id: "j1", operacion: "venta", zona: "Belgrano", precio: 500000, disponible: true, titulo: "JSON" },
    ]);

    const result = await searchProperties({
      tenant_id: "t1",
      operacion: "venta",
      zona: "belgrano",
      presupuestoMax: 400000,
    });

    expect(loadPropertiesFromJsonMock).toHaveBeenCalledTimes(1);
    expect(result.results).toHaveLength(1);
    expect(result.propertiesWithinBudget).toBe(0);
  });

  it("uses Supabase search when PROPERTY_LOADER=supabase", async () => {
    process.env.PROPERTY_LOADER = "supabase";
    searchPropertiesInSupabaseMock.mockResolvedValue([
      { id: "s1", operacion: "venta", zona: "Recoleta", precio: 500000, disponible: true, titulo: "S" },
      { id: "s2", operacion: "venta", zona: "Recoleta", precio: 700000, disponible: true, titulo: "S2" },
    ]);

    const result = await searchProperties({
      tenant_id: "tenant-1",
      operacion: "venta",
      zona: "Recoleta",
      presupuestoMax: 600000,
      limit: 5,
    });

    expect(searchPropertiesInSupabaseMock).toHaveBeenCalledWith({
      tenant_id: "tenant-1",
      operacion: "venta",
      zona: "Recoleta",
      limit: 5,
    });
    expect(result.results).toHaveLength(2);
    expect(result.propertiesWithinBudget).toBe(1);
  });
});
