
const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const db = require("./database/db");

const app = express();

app.use(cors());
app.use(express.json());

// Validate report data received from the frontend.
const reportSchema = z.object({
  id: z.string().uuid(),
  category: z.string().trim().min(1),
  description: z.string().trim().min(10),
  location: z.string().trim().min(1),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  reportedAt: z.string().min(1)
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Offline Field Issue Tracker API is running"
  });
});

// Get all reports
app.get("/api/reports", (req, res) => {
  const reports = db.prepare(
    "SELECT * FROM reports ORDER BY created_at DESC"
  ).all();

  res.json({ success: true, data: reports });
});

// Create a report (safe to retry with the same ID)
app.post("/api/reports", (req, res) => {
  const result = reportSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid report data",
      errors: result.error.flatten()
    });
  }

  const report = result.data;

  try {
    const createReport = db.transaction(() => {
      const existing = db.prepare(
        "SELECT * FROM reports WHERE id = ?"
      ).get(report.id);

      if (existing) {
        return existing;
      }

      db.prepare(`
        INSERT INTO reports (
          id, category, description, location,
          priority, reported_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        report.id,
        report.category,
        report.description,
        report.location,
        report.priority,
        report.reportedAt
      );

      db.prepare(`
        INSERT INTO activities (
          report_id, event_type, description
        )
        VALUES (?, ?, ?)
      `).run(
        report.id,
        "CREATED",
        "Report received by the server"
      );

      return db.prepare(
        "SELECT * FROM reports WHERE id = ?"
      ).get(report.id);
    });

    const savedReport = createReport();

    res.status(201).json({
      success: true,
      data: savedReport
    });
  } catch (error) {
    console.error("Report creation failed:", error);

    res.status(500).json({
      success: false,
      message: "Could not save report"
    });
  }
});

// Get one report and its activity history
app.get("/api/reports/:id", (req, res) => {
  const report = db.prepare(
    "SELECT * FROM reports WHERE id = ?"
  ).get(req.params.id);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: "Report not found"
    });
  }

  const activities = db.prepare(
    `SELECT * FROM activities
     WHERE report_id = ?
     ORDER BY created_at ASC, id ASC`
  ).all(req.params.id);

  res.json({
    success: true,
    data: {
      ...report,
      activities
    }
  });
});

// Allowed status transitions
const allowedTransitions = {
  "Submitted": ["Assigned", "Rejected"],
  "Assigned": ["In Progress", "Rejected"],
  "In Progress": ["Resolved", "Rejected"],
  "Resolved": [],
  "Rejected": []
};

// Update a report's status
app.patch("/api/reports/:id/status", (req, res) => {
  const statusSchema = z.object({
    status: z.enum([
      "Assigned",
      "In Progress",
      "Resolved",
      "Rejected"
    ])
  });

  const result = statusSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid status"
    });
  }

  const newStatus = result.data.status;
  const reportId = req.params.id;

  const report = db.prepare(
    "SELECT * FROM reports WHERE id = ?"
  ).get(reportId);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: "Report not found"
    });
  }

app.post("/api/reports/:id/activities", (req, res) => {
  const activitySchema = z.object({
    eventId: z.string().uuid(),
    eventType: z.enum(["SYNCED", "SYNC_FAILED"]),
    description: z.string().trim().min(1),
  });

  const result = activitySchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid synchronization activity data",
      errors: result.error.flatten(),
    });
  }

  const reportId = req.params.id;

  const report = db
    .prepare("SELECT id FROM reports WHERE id = ?")
    .get(reportId);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: "Report not found",
    });
  }

  const { eventId, eventType, description } = result.data;

  try {
    // INSERT OR IGNORE prevents duplicate events during retries.
    db.prepare(`
      INSERT OR IGNORE INTO activities
        (report_id, event_type, description, event_key)
      VALUES (?, ?, ?, ?)
    `).run(reportId, eventType, description, eventId);

    const activity = db
      .prepare("SELECT * FROM activities WHERE event_key = ?")
      .get(eventId);

    return res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Activity creation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not save synchronization activity",
    });
  }
});


  const allowed = allowedTransitions[report.status];

  if (!allowed || !allowed.includes(newStatus)) {
    return res.status(400).json({
      success: false,
      message: `Cannot change status from ${report.status} to ${newStatus}`
    });
  }

  try {
    const updateStatus = db.transaction(() => {
      db.prepare(`
        UPDATE reports
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, reportId);

      db.prepare(`
        INSERT INTO activities (
          report_id, event_type, description
        )
        VALUES (?, ?, ?)
      `).run(
        reportId,
        "STATUS_CHANGED",
        `Status changed from ${report.status} to ${newStatus}`
      );
    });

    updateStatus();

    const updatedReport = db.prepare(
      "SELECT * FROM reports WHERE id = ?"
    ).get(reportId);

    res.json({
      success: true,
      data: updatedReport
    });
  } catch (error) {
    console.error("Status update failed:", error);

    res.status(500).json({
      success: false,
      message: "Could not update report status"
    });
  }
});


const PORT = 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
