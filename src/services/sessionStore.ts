import { SessionState } from "../types/types.js";

const store = new Map<string, SessionState>();

export function getSession(userId: string): SessionState {
  return store.get(userId) ?? { step: "start" };
}

export function setSession(userId: string, state: SessionState): void {
  store.set(userId, state);
}

export function resetSession(userId: string): void {
  store.delete(userId);
}
