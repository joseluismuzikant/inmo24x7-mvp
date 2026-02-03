import { getSession, setSession, resetSession } from "./sessionStore.js";
import { searchProperties } from "./propertyService.js";
import { BotReply, Operation } from "../types/types.js";

// Helpers simples
function normalizeText(t: string) {
  return t.trim().toLowerCase();
}

function parseOperation(text: string): Operation | null {
  const t = normalizeText(text);
  if (t.includes("alquiler") || t.includes("alquilar") || t === "alquilo") return "alquiler";
  if (t.includes("venta") || t.includes("comprar") || t === "compro") return "venta";
  return null;
}

function parseBudget(text: string): number | null {
  // Saca números tipo "1200", "1.200", "1,200", "usd 1200"
  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  // Heurística simple: si tiene ambos, asumimos separador de miles
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function botReply(args: { userId: string; text: string }): Promise<BotReply> {
  const { userId, text } = args;
  const t = normalizeText(text);

  // comandos útiles de demo
  if (t === "/reset") {
    resetSession(userId);
    return { messages: ["Listo ✅ Reinicié la conversación. ¿Buscás comprar o alquilar?"] };
  }

  const session = getSession(userId);

  // flujo por pasos (determinístico). Después lo cambiás por LLM + function calling.
  switch (session.step) {
    case "start": {
      const next = { ...session, step: "ask_operation" as const };
      setSession(userId, next);
      return {
        messages: [
          "Hola 👋 Soy Inmo24x7, el asistente virtual de la inmobiliaria.",
          "¿Buscás **comprar** o **alquilar**?"
        ]
      };
    }

    case "ask_operation": {
      const op = parseOperation(text);
      if (!op) {
        return { messages: ["¿Me confirmás si es **compra (venta)** o **alquiler**?"] };
      }
      const next = { ...session, operacion: op, step: "ask_zone" as const };
      setSession(userId, next);
      return { messages: ["Genial. ¿En qué **zona/barrio** estás buscando? (Ej: Palermo, Caballito)"] };
    }

    case "ask_zone": {
      const zona = text.trim();
      if (zona.length < 2) return { messages: ["Decime una zona/barrio (por ejemplo: Palermo)."] };

      const next = { ...session, zona, step: "ask_budget" as const };
      setSession(userId, next);
      return { messages: ["Perfecto. ¿Cuál es tu **presupuesto máximo**? (solo número, ej: 1200 o 120000)"] };
    }

    case "ask_budget": {
      const presupuestoMax = parseBudget(text);
      if (!presupuestoMax) {
        return { messages: ["No llegué a leer el número 😅 ¿Cuál es tu **presupuesto máximo**? Ej: 1200"] };
      }

      const operacion = session.operacion!;
      const zona = session.zona!;

      const results = searchProperties({ operacion, zona, presupuestoMax, limit: 3 });

      if (results.length === 0) {
        const next = { ...session, presupuestoMax, lastProperties: [], step: "show_results" as const };
        setSession(userId, next);
        return {
          messages: [
            `Con **${operacion}**, zona **${zona}** y presupuesto **${presupuestoMax}**, no encontré opciones disponibles ahora.`,
            "¿Querés que probemos con otra zona o ajustamos el presupuesto?"
          ]
        };
      }

      const lines = results.map((p, idx) => {
        const link = p.link ? `\nLink: ${p.link}` : "";
        return `**${idx + 1}. ${p.titulo}**\nZona: ${p.zona}\nPrecio: ${p.precio}${link}`;
      });

      const next = { ...session, presupuestoMax, lastProperties: results, step: "show_results" as const };
      setSession(userId, next);

      return {
        messages: [
          "Encontré estas opciones disponibles 👇",
          ...lines,
          "¿Querés que te ponga en contacto con un asesor para coordinar visita? (sí/no)"
        ]
      };
    }

    case "show_results": {
      if (t.startsWith("s") || t.includes("si") || t.includes("sí")) {
        setSession(userId, { ...session, step: "handoff" });
        const summary = [
          `Operación: ${session.operacion}`,
          `Zona: ${session.zona}`,
          `Presupuesto máx: ${session.presupuestoMax}`,
          `Opciones: ${(session.lastProperties ?? []).map((p) => p.id).join(", ") || "N/A"}`
        ].join(" | ");

        return {
          messages: [
            "Perfecto ✅ Te paso con un asesor humano para coordinar la visita.",
            "¿Me compartís tu **nombre** y un **teléfono** de contacto?"
          ],
          handoff: { summary }
        };
      }

      if (t.startsWith("n")) {
        // si dice "no", le damos alternativa rápida
        return { messages: ["Ok 👍 ¿Querés probar con **otra zona** o con **otro presupuesto**? (escribime cuál)"] };
      }

      // Si el usuario responde otra cosa, lo guiamos
      return { messages: ["Decime **sí** para coordinar visita o **no** para ajustar búsqueda."] };
    }

    case "handoff": {
      // MVP: solo simulamos handoff. Después acá mandás a WhatsApp del asesor / email / CRM.
      resetSession(userId);
      return {
        messages: [
          "Gracias 🙌 Un asesor te va a escribir a la brevedad.",
          "Si querés empezar otra búsqueda, escribí cualquier cosa o /reset."
        ]
      };
    }

    default:
      resetSession(userId);
      return { messages: ["Ups, me perdí 😅 Escribí /reset y arrancamos de nuevo."] };
  }
}
