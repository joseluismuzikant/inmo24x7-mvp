import type { ChatMsg, SessionState } from "../types/types.js";
import { getSession, setSession } from "./sessionStore.js";

const MAX_HISTORY = 10;

export type LeadData = {
  operacion?: "venta" | "alquiler";
  zona?: string;
  presupuestoMax?: number;
  nombre?: string;
  contacto?: string;
};

export function loadSession(userId: string): SessionState {
  return getSession(userId);
}

export function saveSession(userId: string, session: SessionState): void {
  setSession(userId, session);
}

export function ensureLeadData(session: SessionState): LeadData {
  if (!session.data) {
    session.data = {};
  }
  return session.data as LeadData;
}

export function getLeadId(session: SessionState): number | undefined {
  return session.leadId;
}

export function setLeadId(session: SessionState, leadId: number): void {
  session.leadId = leadId;
}

export function addMessageToHistory(session: SessionState, message: ChatMsg): void {
  if (!session.history) {
    session.history = [];
  }
  session.history.push(message);
  // Keep only last N messages
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }
}

export function getHistory(session: SessionState): ChatMsg[] {
  return session.history ?? [];
}

export function canCreateLead(data: LeadData): boolean {
  return !!(
    data.operacion &&
    data.zona &&
    typeof data.presupuestoMax === "number" &&
    data.presupuestoMax > 0
  );
}
