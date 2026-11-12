import { useEffect, useState } from "react";
import { getAllReports, saveReport } from "./db/reportDB";
import {
  syncPendingReports,
  getReportDetails,
  updateReportStatus,
} from "./services/reportService";
import {
  LayoutDashboard,
  ClipboardList,
  Plus,
  Search,
  MapPin,
  CalendarDays,
  Wifi,
  WifiOff,
  Droplets,
  Wrench,
  AlertTriangle,
  X,
} from "lucide-react";
import "./App.css";

const initialReports = [
  {
    id: "1",
    category: "Water Supply",
    description: "Community water pump is broken and needs repair.",
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
    status: "In Progress",
    syncStatus: "Pending",
    reportedAt: "2026-11-11",
  },
  {
    id: "3",
    category: "Safety",
    description: "Exposed electrical wires near the community center.",
    location: "Adama",
    priority: "Critical",
    status: "Assigned",
    syncStatus: "Failed",
    reportedAt: "2026-11-10",
  },
];

function App() {
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportActivities, setReportActivities] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    async function loadAndSyncReports() {
      try {
        // Load local reports first, even if offline.
        const savedReports = await getAllReports();
        setReports(savedReports);

        // If internet is available, synchronize them.
        if (navigator.onLine) {
          const updatedReports = await syncPendingReports();
          setReports(updatedReports);
        }
      } catch (error) {
        console.error("Could not load reports:", error);
      }
    }

    function handleOnline() {
      syncPendingReports()
        .then((updatedReports) => {
          setReports(updatedReports);
        })
        .catch((error) => {
          console.error("Automatic synchronization failed:", error);
        });
    }

    loadAndSyncReports();

    // Try synchronization whenever internet returns.
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const [formData, setFormData] = useState({
    category: "Water Supply",
    description: "",
    location: "",
    priority: "Medium",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const newReport = {
      id: crypto.randomUUID(),
      ...formData,
      status: "Submitted",
      syncStatus: "Pending",
      reportedAt: new Date().toISOString(),
    };

    try {
      // First, save the report in the browser database.
      await saveReport(newReport);

      setReports((previous) => [newReport, ...previous]);

      // Try sending the report immediately if internet is available.
      if (navigator.onLine) {
        const updatedReports = await syncPendingReports();
        setReports(updatedReports);
      }

      setFormData({
        category: "Water Supply",
        description: "",
        location: "",
        priority: "Medium",
      });

      setShowForm(false);
    } catch (error) {
      console.error("Could not save report:", error);
      alert("The report could not be saved. Please try again.");
    }
  }

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.description.toLowerCase().includes(search.toLowerCase()) ||
      report.location.toLowerCase().includes(search.toLowerCase()) ||
      report.category.toLowerCase().includes(search.toLowerCase());

    const matchesFilter = filter === "All" || report.status === filter;

    return matchesSearch && matchesFilter;
  });

  const pendingCount = reports.filter(
    (report) => report.syncStatus === "Pending",
  ).length;

  const resolvedCount = reports.filter(
    (report) => report.status === "Resolved",
  ).length;

  async function openReportDetails(report) {
    setSelectedReport(report);
    setReportActivities([]);
    setStatusError("");

    try {
      const details = await getReportDetails(report.id);

      setSelectedReport({
        ...report,
        status: details.status,
      });

      setReportActivities(details.activities || []);
    } catch (error) {
      console.error("Could not load report details:", error);
      setStatusError(
        "Could not load server details. Check your internet connection.",
      );
    }
  }

  async function handleStatusUpdate(event) {
    const newStatus = event.target.value;

    if (!newStatus || !selectedReport) return;

    setStatusLoading(true);
    setStatusError("");

    try {
      // Ask the backend to validate and save the new status.
      await updateReportStatus(selectedReport.id, newStatus);

      // Refresh report details and its activity history.
      const details = await getReportDetails(selectedReport.id);

      const updatedReport = {
        ...selectedReport,
        status: details.status,
      };

      setSelectedReport(updatedReport);
      setReportActivities(details.activities || []);

      // Update the locally stored report too.
      await saveReport(updatedReport);

      setReports((previous) =>
        previous.map((report) =>
          report.id === updatedReport.id ? updatedReport : report,
        ),
      );
    } catch (error) {
      console.error("Status update failed:", error);
      setStatusError(error.message);
    } finally {
      setStatusLoading(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <ClipboardList size={23} />
          </div>
          <div>
            <h2>FieldTrack</h2>
            <span>Issue Management</span>
          </div>
        </div>

        <nav className="navigation">
          <p className="nav-heading">WORKSPACE</p>

          <a className="nav-link active" href="#dashboard">
            <LayoutDashboard size={19} />
            Dashboard
          </a>

          <a className="nav-link" href="#reports">
            <ClipboardList size={19} />
            All Reports
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-status">
            <Wifi size={17} />
            <div>
              <strong>Online mode</strong>
              <span>Connection available</span>
            </div>
          </div>
          <p>Offline Field Issue Tracker</p>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / Dashboard</p>
            <h1>Dashboard</h1>
          </div>

          <button className="primary-button" onClick={() => setShowForm(true)}>
            <Plus size={18} />
            New Report
          </button>
        </header>

        <section className="welcome-section">
          <div>
            <h2>Field Reports Overview</h2>
            <p>
              Monitor infrastructure issues and keep track of field activities.
            </p>
          </div>
          <div className="date-label">
            <CalendarDays size={17} />
            {new Date().toLocaleDateString()}
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <ClipboardList size={21} />
            </div>
            <p>Total Reports</p>
            <h3>{reports.length}</h3>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <WifiOff size={21} />
            </div>
            <p>Pending Sync</p>
            <h3>{pendingCount}</h3>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <ClipboardList size={21} />
            </div>
            <p>Resolved Reports</p>
            <h3>{resolvedCount}</h3>
          </div>

          <div className="stat-card">
            <div className="stat-icon red">
              <AlertTriangle size={21} />
            </div>
            <p>Critical Issues</p>
            <h3>{reports.filter((r) => r.priority === "Critical").length}</h3>
          </div>
        </section>

        <section className="reports-section" id="reports">
          <div className="section-heading">
            <div>
              <h2>Recent Reports</h2>
              <p>Review and manage submitted field issues.</p>
            </div>
          </div>

          <div className="report-controls">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="All">All statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>REPORT</th>
                  <th>LOCATION</th>
                  <th>PRIORITY</th>
                  <th>STATUS</th>
                  <th>SYNC</th>
                  <th>DATE</th>
                </tr>
              </thead>

              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <div className="report-name">
                        <div className="report-icon">
                          {report.category === "Water Supply" ? (
                            <Droplets size={18} />
                          ) : report.category === "Safety" ? (
                            <AlertTriangle size={18} />
                          ) : (
                            <Wrench size={18} />
                          )}
                        </div>
                        <div>
                          <button
                            className="report-open-button"
                            onClick={() => openReportDetails(report)}
                          >
                            {report.category}
                          </button>
                          <span>{report.description}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="location">
                        <MapPin size={15} />
                        {report.location}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`priority ${report.priority.toLowerCase()}`}
                      >
                        {report.priority}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status ${report.status.toLowerCase().replace(" ", "-")}`}
                      >
                        {report.status}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`sync ${report.syncStatus.toLowerCase()}`}
                      >
                        {report.syncStatus}
                      </span>
                    </td>

                    <td>{report.reportedAt}</td>
                  </tr>
                ))}

                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-message">
                      No reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showForm && (
          <div className="modal-backdrop">
            <div className="report-modal">
              <div className="modal-heading">
                <div>
                  <h2>Create New Report</h2>
                  <p>Describe the issue you found in the field.</p>
                </div>
                <button
                  className="close-button"
                  onClick={() => setShowForm(false)}
                  aria-label="Close form"
                >
                  <X size={21} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <label>
                  Category
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  >
                    <option>Water Supply</option>
                    <option>Equipment</option>
                    <option>Service Interruption</option>
                    <option>Safety</option>
                    <option>Other</option>
                  </select>
                </label>

                <label>
                  Description
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Explain what happened..."
                    minLength="10"
                    required
                  />
                </label>

                <label>
                  Location
                  <input
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Enter the issue location"
                    required
                  />
                </label>

                <label>
                  Priority
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-button">
                    Save Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

{selectedReport && (
  <div className="modal-backdrop">
    <div className="report-modal details-modal">
      <div className="modal-heading">
        <div>
          <h2>Report Details</h2>
          <p>Review the report and manage its progress.</p>
        </div>

        <button
          className="close-button"
          onClick={() => setSelectedReport(null)}
          aria-label="Close details"
        >
          <X size={21} />
        </button>
      </div>

      <div className="detail-content">
        <div className="detail-item">
          <span>Category</span>
          <strong>{selectedReport.category}</strong>
        </div>

        <div className="detail-item">
          <span>Description</span>
          <strong>{selectedReport.description}</strong>
        </div>

        <div className="detail-item">
          <span>Location</span>
          <strong>{selectedReport.location}</strong>
        </div>

        <div className="detail-item">
          <span>Priority</span>
          <strong>{selectedReport.priority}</strong>
        </div>

        <div className="detail-item">
          <span>Current status</span>
          <strong>{selectedReport.status}</strong>
        </div>

        <div className="detail-item">
          <span>Synchronization</span>
          <strong>{selectedReport.syncStatus}</strong>
        </div>
      </div>

      <div className="status-update">
        <label htmlFor="status-select">
          Update report status
        </label>

        <select
          id="status-select"
          value=""
          onChange={handleStatusUpdate}
          disabled={statusLoading}
        >
          <option value="">Choose next status</option>

          {(
            {
              Submitted: ["Assigned", "Rejected"],
              Assigned: ["In Progress", "Rejected"],
              "In Progress": ["Resolved", "Rejected"],
              Resolved: [],
              Rejected: [],
              Draft: [],
            }[selectedReport.status] || []
          ).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {statusLoading && <p>Updating status...</p>}
        {statusError && (
          <p className="error-message">{statusError}</p>
        )}
      </div>

      <div className="activity-section">
        <h3>Activity History</h3>

        {reportActivities.length === 0 ? (
          <p className="no-activities">
            No server activity available.
          </p>
        ) : (
          <div className="activity-list">
            {reportActivities.map((activity) => (
              <div className="activity-item" key={activity.id}>
                <div className="activity-dot" />

                <div>
                  <strong>{activity.event_type}</strong>
                  <p>{activity.description}</p>
                  <span>
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}

      </main>
    </div>
  );
}

export default App;
