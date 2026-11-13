
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const path = require("path");

// Set the test database BEFORE importing the app.
process.env.DB_FILE = path.join(__dirname, "test-field-issues.db");

const request = require("supertest");
const app = require("../src/app");
const db = require("../src/database/db");

// Clean the test database before every test.
beforeEach(() => {
  db.prepare("DELETE FROM activities").run();
  db.prepare("DELETE FROM reports").run();
});

// Reusable valid report data.
const validReport = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  category: "Water Supply",
  description: "The water pump is broken and needs repair.",
  location: "Addis Ababa",
  priority: "High",
  reportedAt: "2026-11-13T10:00:00.000Z"
};

// Test 1: Health check.
test("GET /api/health should return a successful response", async () => {
  const response = await request(app).get("/api/health");

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.success, true);
});

// Test 2: Create a valid report.
test("POST /api/reports should create a new report", async () => {
  const response = await request(app)
    .post("/api/reports")
    .send(validReport);

  assert.strictEqual(response.status, 201);
  assert.strictEqual(response.body.success, true);
  assert.strictEqual(response.body.data.id, validReport.id);
  assert.strictEqual(response.body.data.status, "Submitted");
});

// Test 3: Reject invalid report data.
test("POST /api/reports should reject invalid data", async () => {
  const invalidReport = {
    ...validReport,
    description: "Broken"
  };

  const response = await request(app)
    .post("/api/reports")
    .send(invalidReport);

  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.body.success, false);
});

// Test 4: Prevent duplicate reports.
test("POST /api/reports should not create duplicate reports", async () => {
  await request(app)
    .post("/api/reports")
    .send(validReport);

  const secondResponse = await request(app)
    .post("/api/reports")
    .send(validReport);

  const allReports = await request(app).get("/api/reports");

  assert.strictEqual(secondResponse.status, 201);
  assert.strictEqual(allReports.body.data.length, 1);
});

// Test 5: Allow a valid status transition.
test("PATCH /api/reports/:id/status should assign a submitted report", async () => {
  await request(app)
    .post("/api/reports")
    .send(validReport);

  const response = await request(app)
    .patch(`/api/reports/${validReport.id}/status`)
    .send({ status: "Assigned" });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.data.status, "Assigned");
});

// Test 6: Reject an invalid status transition.
test("PATCH /api/reports/:id/status should reject invalid transitions", async () => {
  await request(app)
    .post("/api/reports")
    .send(validReport);

  const response = await request(app)
    .patch(`/api/reports/${validReport.id}/status`)
    .send({ status: "Resolved" });

  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.body.success, false);
});

// Test 7: Record status changes in activity history.
test("GET /api/reports/:id should include activity history", async () => {
  await request(app)
    .post("/api/reports")
    .send(validReport);

  await request(app)
    .patch(`/api/reports/${validReport.id}/status`)
    .send({ status: "Assigned" });

  const response = await request(app)
    .get(`/api/reports/${validReport.id}`);

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.data.activities.length, 2);

  assert.strictEqual(
    response.body.data.activities[0].event_type,
    "CREATED"
  );

  assert.strictEqual(
    response.body.data.activities[1].event_type,
    "STATUS_CHANGED"
  );
});

// Test 8: Record a successful synchronization event.
test("POST /api/reports/:id/activities should record SYNCED activity", async () => {
  await request(app)
    .post("/api/reports")
    .send(validReport);

  const response = await request(app)
    .post(`/api/reports/${validReport.id}/activities`)
    .send({
      eventId: "550e8400-e29b-41d4-a716-446655440001",
      eventType: "SYNCED",
      description: "Report successfully synchronized with the server"
    });

  assert.strictEqual(response.status, 201);
  assert.strictEqual(response.body.success, true);
  assert.strictEqual(response.body.data.event_type, "SYNCED");
});

// Test 9: Record a failed synchronization event.
test("POST /api/reports/:id/activities should record SYNC_FAILED activity", async () => {
  await request(app)
    .post("/api/reports")
    .send(validReport);

  const response = await request(app)
    .post(`/api/reports/${validReport.id}/activities`)
    .send({
      eventId: "550e8400-e29b-41d4-a716-446655440002",
      eventType: "SYNC_FAILED",
      description: "Network connection failed during synchronization"
    });

  assert.strictEqual(response.status, 201);
  assert.strictEqual(response.body.data.event_type, "SYNC_FAILED");
});

// Test 10: Prevent duplicate synchronization activities.
test("POST /api/reports/:id/activities should prevent duplicate events", async () => {
  await request(app)
    .post("/api/reports")
    .send(validReport);

  const activity = {
    eventId: "550e8400-e29b-41d4-a716-446655440003",
    eventType: "SYNCED",
    description: "Report successfully synchronized"
  };

  await request(app)
    .post(`/api/reports/${validReport.id}/activities`)
    .send(activity);

  await request(app)
    .post(`/api/reports/${validReport.id}/activities`)
    .send(activity);

  const response = await request(app)
    .get(`/api/reports/${validReport.id}`);

  // One CREATED activity + one SYNCED activity.
  assert.strictEqual(response.body.data.activities.length, 2);
});

// Test 11: Reject invalid synchronization activity data.
test("POST /api/reports/:id/activities should reject invalid data", async () => {
  await request(app)
    .post("/api/reports")
    .send(validReport);

  const response = await request(app)
    .post(`/api/reports/${validReport.id}/activities`)
    .send({
      eventId: "not-a-valid-uuid",
      eventType: "UNKNOWN",
      description: ""
    });

  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.body.success, false);
});

// Test 12: Reject activities for reports that do not exist.
test("POST /api/reports/:id/activities should return 404 for missing reports", async () => {
  const response = await request(app)
    .post("/api/reports/550e8400-e29b-41d4-a716-446655440099/activities")
    .send({
      eventId: "550e8400-e29b-41d4-a716-446655440004",
      eventType: "SYNCED",
      description: "Report successfully synchronized"
    });

  assert.strictEqual(response.status, 404);
  assert.strictEqual(response.body.success, false);
});

