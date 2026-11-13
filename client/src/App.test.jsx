
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import App from "./App";

// Mock IndexedDB functions.
vi.mock("./db/reportDB", () => ({
  getAllReports: vi.fn(),
  saveReport: vi.fn(),
}));

// Mock backend service functions.
vi.mock("./services/reportService", () => ({
  syncPendingReports: vi.fn(),
  getReportDetails: vi.fn(),
  updateReportStatus: vi.fn(),
}));

import { getAllReports } from "./db/reportDB";
import { syncPendingReports } from "./services/reportService";

describe("FieldTrack Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should display the dashboard and report statistics", async () => {
    const mockReports = [
      {
        id: "1",
        category: "Water Supply",
        description: "Community water pump is broken.",
        location: "Addis Ababa",
        priority: "High",
        status: "Submitted",
        syncStatus: "Synchronized",
        reportedAt: "2026-11-12",
      },
      {
        id: "2",
        category: "Equipment",
        description: "A damaged generator needs maintenance.",
        location: "Bishoftu",
        priority: "Critical",
        status: "Resolved",
        syncStatus: "Pending",
        reportedAt: "2026-11-11",
      },
    ];

    getAllReports.mockResolvedValue(mockReports);
    syncPendingReports.mockResolvedValue(mockReports);

    render(<App />);

    // Check that the dashboard heading appears.
    expect(
      screen.getByRole("heading", { name: "Dashboard" })
    ).toBeInTheDocument();

    // Wait until reports are loaded.
    await waitFor(() => {
      expect(screen.getByText("Community water pump is broken."))
        .toBeInTheDocument();
    });

    // Check report statistics.
    expect(screen.getByText("Total Reports").parentElement)
      .toHaveTextContent("2");

    expect(screen.getByText("Pending Sync").parentElement)
      .toHaveTextContent("1");

    expect(screen.getByText("Resolved Reports").parentElement)
      .toHaveTextContent("1");

    expect(screen.getByText("Critical Issues").parentElement)
      .toHaveTextContent("1");
  });

it("should filter reports when the user searches", async () => {
  const mockReports = [
    {
      id: "1",
      category: "Water Supply",
      description: "Community water pump is broken.",
      location: "Addis Ababa",
      priority: "High",
      status: "Submitted",
      syncStatus: "Synchronized",
      reportedAt: "2026-11-12",
    },
    {
      id: "2",
      category: "Equipment",
      description: "A damaged generator needs maintenance.",
      location: "Bishoftu",
      priority: "Medium",
      status: "Assigned",
      syncStatus: "Synchronized",
      reportedAt: "2026-11-11",
    },
  ];

  getAllReports.mockResolvedValue(mockReports);
  syncPendingReports.mockResolvedValue(mockReports);

  render(<App />);

  // Wait for reports to load.
  expect(
    await screen.findByText("Community water pump is broken.")
  ).toBeInTheDocument();

  // Search for the water pump report.
  const searchInput = screen.getByPlaceholderText("Search reports...");

  fireEvent.change(searchInput, {
    target: { value: "water pump" },
  });

  // The matching report should remain visible.
  expect(
    screen.getByText("Community water pump is broken.")
  ).toBeInTheDocument();

  // The unrelated report should disappear.
  expect(
    screen.queryByText("A damaged generator needs maintenance.")
  ).not.toBeInTheDocument();
});

});
