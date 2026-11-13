# Offline Field Issue Tracker

An offline-first web application for field workers to report infrastructure issues and coordinators to manage their progress.

## 1. Project Overview

Field workers may operate in areas with unreliable or limited internet connectivity. This application allows them to record infrastructure problems even when offline and synchronize their reports with the central server when an internet connection becomes available.

The system supports issue reporting, synchronization tracking, report management, and activity history.

## 2. Key Features

- **Create reports:** Record the issue category, description, location, and priority.
- **Offline-first reporting:** Save reports locally using IndexedDB, even without internet access.
- **Automatic synchronization:** Automatically attempt to synchronize pending reports when connectivity is available.
- **Synchronization status:** Track reports as Pending, Synchronized, or Failed.
- **Duplicate prevention:** Use UUIDs and server-side uniqueness checks to prevent duplicate reports during retries.
- **Report management:** View reports, search by description or location, and filter by status.
- **Status management:** Coordinators can update report progress through valid workflow transitions.
- **Activity history:** Record report creation and status changes.
- **Offline application shell:** Use a Service Worker to cache the application shell and assets for offline access.

## 3. Technology Stack

| Area             | Technologies                         |
| ---------------- | ------------------------------------ |
| Frontend         | React, Vite, JavaScript, CSS         |
| Backend          | Node.js, Express.js                  |
| Database         | SQLite, better-sqlite3               |
| Local storage    | IndexedDB, idb                       |
| Offline support  | Service Worker, Cache API            |
| Validation       | Zod                                  |
| Backend testing  | Node.js Test Runner, Supertest       |
| Frontend testing | Vitest, React Testing Library, jsdom |

## 4. Application Architecture

The application has three main parts:

1. **Frontend:** React provides the dashboard, report form, search, filtering, and coordinator interface.
2. **Local storage:** IndexedDB stores reports in the browser so they remain available across refreshes and offline sessions.
3. **Backend:** Express provides the REST API, while SQLite persistently stores synchronized reports and their activity history.

### Data flow

1. A field worker creates a report.
2. The frontend generates a UUID for the report.
3. The report is saved in IndexedDB first.
4. If the device is online, the application attempts to send the report to the backend.
5. If synchronization succeeds, its local synchronization status becomes Synchronized.
6. If synchronization fails or the device is offline, the report remains locally stored as Pending or Failed.
7. When connectivity returns, the application retries synchronization using the same UUID.

The local database preserves reports while offline. The backend database stores reports that have been successfully synchronized.

## 5. Report Workflow

The supported business status transitions are:

```text
Submitted
   |
   +------> Assigned
   |           |
   |           +------> In Progress
   |                       |
   |                       +------> Resolved
   |
   +------> Rejected

Assigned ------> Rejected
In Progress ---> Rejected
```

Resolved and Rejected are terminal statuses.

Business status and synchronization status are separate:

- **Business status** describes the progress of an issue.
- **Synchronization status** describes whether the report has reached the server.

## 6. Project Structure

```text
offline-field-issue-tracker/
│
├── client/
│   ├── public/
│   │   └── sw.js
│   └── src/
│       ├── db/
│       │   └── reportDB.js
│       ├── services/
│       │   └── reportService.js
│       ├── test/
│       │   └── setup.js
│       ├── App.jsx
│       ├── App.css
│       ├── App.test.jsx
│       ├── index.css
│       └── main.jsx
│
├── server/
│   ├── data/
│   ├── src/
│   │   ├── database/
│   │   │   └── db.js
│   │   └── app.js
│   └── tests/
│       └── app.test.js
│
└── README.md
```

## 7. Getting Started

### Prerequisites

- Node.js and npm
- Git

### Clone the repository

```bash
git clone https://github.com/tsionkinde/Offline-Field-Issue-Tracker.git
cd Offline-Field-Issue-Tracker
```

### Backend setup

```bash
cd server
npm install
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### Frontend setup

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL displayed by Vite in your browser.

### Production build and offline testing

To build the frontend:

```bash
cd client
npm run build
npm run preview
```

Open the preview URL provided by Vite.

The Service Worker is registered in production mode. Test offline behavior using the browser's developer tools and Network tab.

## 8. API Endpoints

| Method | Endpoint                  | Description                                  |
| ------ | ------------------------- | -------------------------------------------- |
| GET    | `/api/health`             | Check backend availability                   |
| GET    | `/api/reports`            | Retrieve all reports                         |
| POST   | `/api/reports`            | Create or retrieve an existing report        |
| GET    | `/api/reports/:id`        | Retrieve report details and activity history |
| PATCH  | `/api/reports/:id/status` | Update a report's business status            |

The backend validates incoming report data and checks allowed status transitions.

## 9. Testing

### Backend tests

From the `server` directory:

```bash
npm test
```

The backend test suite covers:

- Health endpoint.
- Report creation.
- Invalid report validation.
- Duplicate report prevention.
- Valid status transitions.
- Invalid status transitions.
- Activity history.

### Frontend tests

From the `client` directory:

```bash
npm test
```

The frontend test suite currently covers:

- Dashboard rendering and report statistics.
- Report search functionality.

### Manual offline testing

The following offline scenario was manually verified:

1. Open the production preview application.
2. Enable Offline mode in browser developer tools.
3. Refresh the application and verify that the dashboard loads.
4. Create a report while offline.
5. Verify that the report appears with Pending synchronization status.
6. Restore the connection using No throttling.
7. Verify that the report becomes Synchronized.

## 10. Assumptions and Limitations

- Each report receives a UUID on the client before synchronization.
- The backend uses the report ID to prevent duplicate creation during retries.
- IndexedDB is used for browser-side persistence.
- The application currently uses a local SQLite database.
- The frontend API URL is configured for local development.
- The current application does not implement user authentication or role-based access control.
- Synchronization is initiated when the application loads while online or when the browser fires an online event.
- Failed reports remain stored locally and can be retried.
- The current activity history records creation and business status changes; synchronization attempts and failures are not yet persisted as server activity events.

## 11. Future Improvements

- Add authentication and role-based access for field workers and coordinators.
- Add richer synchronization activity logs.
- Add a manual retry option for failed reports.
- Add location coordinates and map integration.
- Add image attachments for reported issues.
- Improve conflict resolution for simultaneous updates.
- Add deployment and cloud database support.

## 12. Project Information

**Project:** Offline Field Issue Tracker  
**Organization:** NilePixel Technologies – Cohort 1 Graduation Project  
**Developer:** Tsion Kinde Ayalew  
**GitHub:** https://github.com/tsionkinde/Offline-Field-Issue-Tracker

## 13. AI Assistance Disclosure

AI tools were used as development assistance for learning, debugging, implementation guidance, and documentation. The project was developed and tested through hands-on implementation and verification.
