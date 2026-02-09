import { Router } from "express";
import { getAllLeads, getLeadById, deleteLead } from "../repositories/leadRepo.js";

const router = Router();

// Get all leads
router.get("/api/leads", (_req, res) => {
  try {
    const leads = getAllLeads();
    res.json({ leads });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// Get lead by ID
router.get("/api/leads/:id", (req, res) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }

    const lead = getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lead" });
  }
});

// Delete lead
router.delete("/api/leads/:id", (req, res) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }

    deleteLead(leadId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

export { router as leadsRouter };
