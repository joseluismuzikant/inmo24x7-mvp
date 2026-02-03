import fs from "node:fs";
import path from "node:path";
import { Property, Operation } from "../types/types.js";

let cache: Property[] | null = null;

function loadProperties(): Property[] {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "src", "data", "properties.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as Property[];
  cache = data;
  return data;
}

export function searchProperties(args: {
  operacion: Operation;
  zona: string;
  presupuestoMax: number;
  limit?: number;
}): Property[] {
  const { operacion, zona, presupuestoMax, limit = 3 } = args;
  const properties = loadProperties();

  const normZona = zona.trim().toLowerCase();

  return properties
    .filter((p) => p.disponible)
    .filter((p) => p.operacion === operacion)
    .filter((p) => p.zona.trim().toLowerCase().includes(normZona))
    .filter((p) => p.precio <= presupuestoMax)
    .sort((a, b) => a.precio - b.precio)
    .slice(0, limit);
}
