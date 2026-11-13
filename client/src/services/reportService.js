
import { getAllReports, saveReport } from "../db/reportDB";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Create a synchronization activity and save it locally first.
function createSyncEvent(eventType, description) {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    description,
  };
}

// Send locally saved synchronization activities to the server.
async function sendPendingActivities(report) {
  const pendingEvents = report.pendingSyncEvents || [];

  for (const event of pendingEvents) {
    try {
      const response = await fetch(
        `${API_URL}/reports/${report.id}/activities`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error(`Activity request failed: ${response.status}`);
      }

      // Remove the event after the server confirms it.
      report.pendingSyncEvents = report.pendingSyncEvents.filter(
        (item) => item.eventId !== event.eventId
      );

      if (event.eventType === "SYNCED") {
        report.syncSuccessLogged = true;
      }

      await saveReport(report);
    } catch (error) {
      console.error("Could not send synchronization activity:", error);

      // Keep the event locally. It will be retried later.
    }
  }
}

// Send locally saved reports to the backend.
export async function syncPendingReports() {
  const reports = await getAllReports();

  const reportsToProcess = reports.filter(
    (report) =>
      report.syncStatus === "Pending" ||
      report.syncStatus === "Failed" ||
      (report.pendingSyncEvents || []).length > 0
  );

  for (const report of reportsToProcess) {
    try {
      // Only upload the report if it has not synchronized yet.
      if (report.syncStatus !== "Synchronized") {
        const response = await fetch(`${API_URL}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

        report.syncStatus = "Synchronized";
        report.lastSyncError = null;
      }

      // Create the success event only once.
      const hasPendingSuccessEvent = (
        report.pendingSyncEvents || []
      ).some((event) => event.eventType === "SYNCED");

      if (!report.syncSuccessLogged && !hasPendingSuccessEvent) {
        report.pendingSyncEvents = report.pendingSyncEvents || [];

        report.pendingSyncEvents.push(
          createSyncEvent(
            "SYNCED",
            "Report successfully synchronized with the server"
          )
        );
      }

      await saveReport(report);

      // Send pending success and failure activities.
      await sendPendingActivities(report);
    } catch (error) {
      console.error("Synchronization failed:", error);

      report.syncStatus = "Failed";
      report.lastSyncError = error.message;
      report.pendingSyncEvents = report.pendingSyncEvents || [];

      // Save the failure event locally for delivery when online again.
      report.pendingSyncEvents.push(
        createSyncEvent(
          "SYNC_FAILED",
          `Synchronization failed: ${error.message}`
        )
      );

      await saveReport(report);
    }
  }

  return getAllReports();
}

export async function getReportDetails(id) {
  const response = await fetch(`${API_URL}/reports/${id}`);

  if (!response.ok) {
    throw new Error("Could not load report details");
  }

  const result = await response.json();
  return result.data;
}

export async function updateReportStatus(id, status) {
  const response = await fetch(`${API_URL}/reports/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not update report status");
  }

  return result.data;
}
