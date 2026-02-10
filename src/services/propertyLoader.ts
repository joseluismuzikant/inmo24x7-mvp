import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { Property, Operation } from "../types/types.js";

let propertiesCache: Property[] | null = null;

function parseOperacion(operacion: string): Operation | null {
  const normalized = operacion.toLowerCase().trim();
  if (normalized === "venta") return "venta";
  if (normalized === "alquiler") return "alquiler";
  return null;
}

function safeParseJson(jsonStr: string): any {
  try {
    return JSON.parse(jsonStr.replace(/'/g, '"'));
  } catch {
    return undefined;
  }
}

export function loadPropertiesFromCSV(): Property[] {
  if (propertiesCache) {
    return propertiesCache;
  }

  const filePath = path.join(process.cwd(), "src", "data", "zonaprop-argentina-dataset.csv");
  const csv = fs.readFileSync(filePath, "utf-8");

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const properties = rows
    .map((r: any, idx: number): Property | null => {
      const operacion = parseOperacion(r.Operacion || "");
      if (!operacion) return null;

      const zona = r.Zona3 || r.Zona2 || r.Zona || "";
      if (!zona) return null;

      const precioRaw = String(r.Precio || "").replace(/[^\d]/g, "");
      const precio = Number(precioRaw);
      if (!precio || isNaN(precio)) return null;

      const currency = r.Currency || "USD";
      
      // Convert USD to ARS for consistent comparison
      const precioARS = currency === "USD" ? precio * 1000 : precio;

      // Parse images
      let imagenes: string[] | undefined;
      if (r.Imagenes) {
        imagenes = safeParseJson(r.Imagenes);
      }

      // Parse development features
      let development_features: Record<string, any> | undefined;
      if (r.developmentFeatures) {
        development_features = safeParseJson(r.developmentFeatures);
      }

      return {
        // Identificación
        id: `ZP-${idx.toString().padStart(6, "0")}`,
        posting_id: r.posting_id,
        
        // Información básica
        operacion,
        zona: zona.trim(),
        zona2: r.Zona2,
        zona3: r.Zona3,
        precio: precioARS,
        currency,
        titulo: (r.Title || "Sin título").trim(),
        generatedTitle: r.generatedTitle,
        description: r.Description,
        link: r.url,
        url: r.url,
        disponible: r.estatus !== "offline",
        estatus: r.estatus,
        
        // Imágenes
        imagenes,
        numero_de_imagenes: r.Numero_de_imagenes ? Number(r.Numero_de_imagenes) : undefined,
        
        // Características
        tipo: r.Tipo,
        ambientes: r.Ambientes ? Number(r.Ambientes) : undefined,
        banos: r.Banos ? Number(r.Banos) : undefined,
        dormitorios: r.Dormitorios ? Number(r.Dormitorios) : undefined,
        dimension_terreno: r.Dimension_terreno,
        dimension_propiedad: r.Dimension_propiedad,
        nueva_usada: r.Nueva_usada,
        
        // Ubicación
        address: r.address,
        latitude: r.latitude ? Number(r.latitude) : undefined,
        longitude: r.longitude ? Number(r.longitude) : undefined,
        
        // Publicación
        fecha_de_publicacion: r.Fecha_de_publicacion,
        visualizaciones: r.Visualizaciones ? Number(r.Visualizaciones) : undefined,
        
        // Vendedor
        tipovendedor: r.Tipovendedor,
        seller_name: r.Seller_name,
        seller_id: r.Seller_ID,
        seller_url: r.Seller_url,
        phone1: r.Phone1,
        phone2: r.Phone2,
        seller_level: r.seller_level,
        
        // Extras
        development_features,
        superdestacado: r.Superdestacado,
        premium_label: r.Premium_label,
        proveedor_tour: r.proveedor_tour,
        expenses: r.expenses,
      };
    })
    .filter((p): p is Property => p !== null);

  propertiesCache = properties;
  console.log(`✅ Loaded ${properties.length} properties from CSV`);
  return properties;
}

export function loadPropertiesFromJson(): Property[] {
  if (propertiesCache) {
    return propertiesCache;
  }

  const filePath = path.join(process.cwd(), "src", "data", "properties.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const properties: Property[] = JSON.parse(raw);

  // Ensure all required fields are present
  const validatedProperties = properties.map((p, idx) => ({
    ...p,
    id: p.id || `JSON-${idx.toString().padStart(4, "0")}`,
    currency: p.currency || "ARS",
    disponible: p.disponible ?? true,
  }));

  propertiesCache = validatedProperties;
  console.log(`✅ Loaded ${validatedProperties.length} properties from JSON`);
  return validatedProperties;
}

export function clearPropertiesCache(): void {
  propertiesCache = null;
}

export function getPropertiesCount(): number {
  if (!propertiesCache) {
    loadPropertiesFromCSV();
  }
  return propertiesCache?.length || 0;
}
