
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
