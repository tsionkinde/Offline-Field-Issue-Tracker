
import { openDB } from "idb";

// Open the browser database.
const databasePromise = openDB("field-issue-tracker", 1, {
  upgrade(database) {
    // Create the reports table only if it does not exist.
    if (!database.objectStoreNames.contains("reports")) {
      database.createObjectStore("reports", {
        keyPath: "id",
      });
    }
  },
});

// Save a report or update an existing report.
export async function saveReport(report) {
  const database = await databasePromise;

  await database.put("reports", report);
}

// Get all reports saved in the browser.
export async function getAllReports() {
  const database = await databasePromise;

  return database.getAll("reports");
}

// Get one report using its ID.
export async function getReportById(id) {
  const database = await databasePromise;

  return database.get("reports", id);
}
