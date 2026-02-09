import { createLead, updateLead, getLeadByUserId, type Lead } from "../repositories/leadRepo";
import type { LeadData } from "./sessionService";

export class LeadService {
  loadOrCreateLead(userId: string, sessionData: LeadData, sessionLeadId?: number): number | undefined {
    // If we already have a leadId in session, use it
    if (sessionLeadId) {
      return sessionLeadId;
    }

    // Try to find an existing lead in the database
    const existingLead = getLeadByUserId(userId);
    if (existingLead) {
      // Update session data with existing lead data
      if (existingLead.operacion) sessionData.operacion = existingLead.operacion as "venta" | "alquiler";
      if (existingLead.zona) sessionData.zona = existingLead.zona;
      if (existingLead.presupuestoMax) sessionData.presupuestoMax = existingLead.presupuestoMax;
      if (existingLead.nombre) sessionData.nombre = existingLead.nombre;
      if (existingLead.contacto) sessionData.contacto = existingLead.contacto;
      return existingLead.id;
    }

    // Create new lead if we have enough data
    if (this.canCreateLead(sessionData)) {
      const leadId = createLead({
        userId,
        operacion: sessionData.operacion,
        zona: sessionData.zona,
        presupuestoMax: sessionData.presupuestoMax,
        nombre: sessionData.nombre,
        contacto: sessionData.contacto,
      });
      return leadId;
    }

    return undefined;
  }

  updateLeadData(leadId: number, data: Partial<LeadData>, summary?: string): void {
    const updateData: Record<string, any> = { ...data };
    if (summary) {
      updateData.summary = summary;
    }
    updateLead(leadId, updateData);
  }

  private canCreateLead(data: LeadData): boolean {
    return !!(
      data.operacion &&
      data.zona &&
      typeof data.presupuestoMax === "number" &&
      data.presupuestoMax > 0
    );
  }
}

export const leadService = new LeadService();
