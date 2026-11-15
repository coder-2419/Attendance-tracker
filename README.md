# Attendance Tracker

A mobile-friendly attendance planner for tracking course attendance, viewing a weekly timetable, planning around target percentages, and organizing semester events.

## Features

- Course attendance percentages, present/absent counts, target status, and safe bunk or recovery guidance.
- Daily timetable with per-class attendance marking and automatic absent marking after a class ends.
- What-If simulator for previewing future classes without changing saved attendance.
- CSV export and a printable attendance report.
- Semester calendar with start/end dates, blocked dates before the semester begins, and full-day attendance marks.
- Events with categories, filters, date sorting, and a horizontally browsable event banner. Events are saved only on the current device.
- Separate Sem 1–Sem 8 course and attendance archives.
- Timetable sharing by code with merge and replace options.
- Local persistence, optional Cloud Firestore sync for signed-in users, and light/dark themes.

## Run locally

Open `index.html` through a local web server. Firebase is optional for local attendance tracking; without runtime Firebase configuration, cloud sign-in, syncing, and timetable sharing are disabled while local features continue to work.

To enable Firebase locally, create an ignored `firebase-config.js` file in the project root with your Firebase Web app configuration:

```js
window.__FIREBASE_CONFIG__ = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

This file is excluded by `.gitignore`; do not commit it.

## Deploy to GitHub Pages

The workflow at `.github/workflows/deploy.yml` builds the Firebase runtime config from GitHub Actions secrets and deploys the repository to GitHub Pages whenever code is pushed to `main` (or when manually run).

1. In the repository on GitHub, open **Settings → Secrets and variables → Actions → New repository secret**.
2. Add these six secrets from the Firebase project’s Web app configuration:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
3. In **Settings → Pages**, set the build and deployment source to **GitHub Actions**.
4. Push to `main`, or run **Actions → Deploy Attendance Tracker to GitHub Pages → Run workflow**.

The deployment fails with a clear message if any required secret is missing. After a successful run, the workflow publishes the site URL in its deployment summary.

## Firebase configuration and security

Firebase browser configuration is generated only during deployment, so values are not present in the latest source files. A browser app must still receive its Firebase Web configuration at runtime; visitors can inspect it in the deployed site. Firebase Web API keys identify the project and are not authorization to read or write data by themselves. Secure access with Firebase Authentication, Firestore Security Rules, and API key restrictions. Since this project’s prior source included its web config, review/restrict that key in Google Cloud Console if the repository was public; changing the source does not erase values from earlier Git commits.

## Data notes

Attendance, course, calendar, semester, and event data use browser local storage. Signed-in attendance data can sync to the app’s Firestore user document. Events remain device-local and are not synced across devices. Clearing browser storage removes local-only data; export or preserve it before clearing browser data.
