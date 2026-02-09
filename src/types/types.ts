export type Operation = "venta" | "alquiler";

export type Property = {
  id: string;
  operacion: Operation;
  zona: string;
  precio: number; // en la unidad que definas (USD o ARS)
  titulo: string;
  link?: string;
  disponible: boolean;
};

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type SessionState = {
  // 👇 flujo actual (NO lo tocamos todavía)
  step: "start" | "ask_operation" | "ask_zone" | "ask_budget" | "show_results" | "handoff";

  // 👇 datos estructurados (nuevo)
  data?: {
    operacion?: "venta" | "alquiler";
    zona?: string;
    presupuestoMax?: number;
    nombre?: string;
    contacto?: string;
  };

  // 👇 persistencia
  leadId?: number;

  // 👇 opcional (IA)
  history?: ChatMsg[];

  // 👇 legacy (si lo usás)
  lastProperties?: Property[];
};

export type BotReply = {
  messages: string[];
  handoff?: {
    summary: string;
  };
};

