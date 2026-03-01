import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPropertiesCache,
  getPropertiesCount,
  loadPropertiesFromCSV,
  loadPropertiesFromJson,
} from "../../src/services/propertyLoader.ts";

describe("propertyLoader", () => {
  beforeEach(() => {
    clearPropertiesCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearPropertiesCache();
  });

  it("loads and maps CSV properties", () => {
    const csv = [
      "Operacion,Zona,Precio,Currency,Title,estatus,url",
      "venta,Palermo,100000,USD,Depto A,online,https://example.com/a",
      "alquiler,Belgrano,550000,ARS,Depto B,offline,https://example.com/b",
    ].join("\n");

    vi.spyOn(fs, "readFileSync").mockReturnValue(csv as any);

    const properties = loadPropertiesFromCSV();

    expect(properties).toHaveLength(2);
    expect(properties[0].operacion).toBe("venta");
    expect(properties[0].precio).toBe(100000000);
    expect(properties[0].disponible).toBe(true);
    expect(properties[1].disponible).toBe(false);
  });

  it("loads JSON properties and applies defaults", () => {
    const raw = JSON.stringify([
      { titulo: "Casa", operacion: "venta", zona: "Caballito", precio: 10, disponible: undefined },
    ]);

    vi.spyOn(fs, "readFileSync").mockReturnValue(raw as any);

    const properties = loadPropertiesFromJson();
    expect(properties).toHaveLength(1);
    expect(properties[0].id).toBe("JSON-0000");
    expect(properties[0].currency).toBe("ARS");
    expect(properties[0].disponible).toBe(true);
  });

  it("returns property count from cache", () => {
    const csv = ["Operacion,Zona,Precio,Currency,Title", "venta,Palermo,100000,USD,Depto A"].join("\n");
    vi.spyOn(fs, "readFileSync").mockReturnValue(csv as any);

    expect(getPropertiesCount()).toBe(1);
    expect(getPropertiesCount()).toBe(1);
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
  });
});
