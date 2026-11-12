
import { getAllReports, saveReport } from "../db/reportDB";

const API_URL = "http://localhost:5000/api";

// Send locally saved reports to the backend.
export async function syncPendingReports() {
  const reports = await getAllReports();

  // Only send reports that still need synchronization.
  const pendingReports = reports.filter(
    (report) =>
      report.syncStatus === "Pending" ||
      report.syncStatus === "Failed"
  );

  for (const report of pendingReports) {
    try {
      const response = await fetch(`${API_URL}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: report.id,
          category: report.category,
          description: report.description,
          location: report.location,
          priority: report.priority,
          reportedAt: report.reportedAt,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      // The server accepted the report.
      await saveReport({
        ...report,
        syncStatus: "Synchronized",
        lastSyncError: null,
      });
    } catch (error) {
      console.error("Synchronization failed:", error);

      // Keep the report locally so it can be retried later.
      await saveReport({
        ...report,
        syncStatus: "Failed",
        lastSyncError: error.message,
      });
    }
  }

  // Return the latest local data after synchronization.
  return getAllReports();
}

// Get a report and its activity history from the server.
export async function getReportDetails(id) {
  const response = await fetch(`${API_URL}/reports/${id}`);

  if (!response.ok) {
    throw new Error("Could not load report details");
  }

  const result = await response.json();

  return result.data;
}

// Update a report's business status.
export async function updateReportStatus(id, status) {
  const response = await fetch(`${API_URL}/reports/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not update report status");
  }

  return result.data;
}
