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

To enable Firebase locally, copy `firebase-config.example.js` to `firebase-config.js` and fill in your Firebase Web app configuration:

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

`firebase-config.js` is excluded by `.gitignore`; do not commit it. Firebase Web configuration is public client data, so this keeps it out of source control but does not make the deployed browser config secret.

## Deploy to GitHub Pages

The workflow at `.github/workflows/deploy.yml` builds the Firebase runtime config from GitHub Actions settings and deploys the repository to GitHub Pages whenever code is pushed to `main` (or when manually run). It checks repository secrets first, then repository variables. A `.env` file is not loaded by GitHub Pages. Values included in a Pages build are visible to site visitors, even when supplied to the build as GitHub Secrets.

1. In the repository on GitHub, open **Settings → Secrets and variables → Actions**.
2. Add the six names below on the **Variables** tab as repository variables (they are public client configuration, not secrets). Use the exact values from the Firebase project’s Web app configuration:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
3. In **Settings → Pages**, set the build and deployment source to **GitHub Actions**.
4. Push to `main`, or run **Actions → Deploy Attendance Tracker to GitHub Pages → Run workflow**.

The deployment fails with a clear message if any required value is missing. After a successful run, the workflow publishes the site URL in its deployment summary.

## Firebase configuration and security

The Firebase web `apiKey` identifies the Firebase project; it is not an admin credential and cannot replace Firebase Authentication or Firestore Rules. Any browser configuration (including one generated from a GitHub Secret) is readable from the deployed site. Do not put service account JSON, Admin SDK private keys, webhook secrets, or paid third-party API secrets in this frontend or in GitHub Pages build variables.

### Restrict the browser API key

In Google Cloud Console, open **APIs & Services → Credentials**, select the Firebase browser key, and set **Application restrictions → Websites**. Add the production referrer `https://coder-2419.github.io/*` and the exact localhost origin/port used for development (for example `http://localhost:5500/*`). Under **API restrictions**, allow only the Firebase APIs required by this app, including Identity Toolkit, Token Service, Cloud Firestore, and Cloud Datastore. Check the Firebase-provided key's current restrictions before changing them; overly narrow API restrictions can break sign-in or Firestore.

### Publish Firestore rules

`firestore.rules` limits each signed-in user to their own user document, prevents clients from changing the role field, and permits signed-in timetable share-code creation/import. Other collections are denied by default. Publish the rules from the repository root with Firebase CLI after reviewing them:

```sh
firebase deploy --only firestore:rules
```

This command updates the live database security policy. The rules are also linked from `firebase.json` for Firebase CLI deployments. GitHub Pages does not publish Firestore rules.

### App Check (optional)

Register the web app in **Firebase Console → App Check** with reCAPTCHA v3, deploy the App Check client integration and monitor valid traffic before enabling enforcement. Keep the reCAPTCHA secret in Firebase Console; a reCAPTCHA site key is public client configuration. Enforcing App Check before a working client is deployed can block app requests.

### Legacy payment webhook secret

The legacy webhook function reads `UPI_WEBHOOK_SECRET` from Firebase Secret Manager. Before deploying that function, set a new value with `firebase functions:secrets:set UPI_WEBHOOK_SECRET`, then deploy with `firebase deploy --only functions:autoVerifyUpiWebhook`. The old in-source placeholder is no longer used. Do not use the same secret that may have appeared in a previous public commit.

### Local keys and Git history

The local `firebase-config.js` file is ignored by Git, and `firebase-config.example.js` contains placeholders only. `.env` files are ignored too, but GitHub Pages does not read them. Removing a value from the current files does not erase old commits. Since the Firebase web key is public by design, restrict it in Google Cloud Console; if a true private credential was committed, revoke/rotate it and clean repository history separately.

## Data notes

Attendance, course, calendar, semester, and event data use browser local storage. Signed-in attendance data can sync to the app’s Firestore user document. Events remain device-local and are not synced across devices. Clearing browser storage removes local-only data; export or preserve it before clearing browser data.
