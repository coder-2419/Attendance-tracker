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

Open `index.html` through a local web server. Firebase Web app configuration is defined in `script.js` and is used by both local development and the deployed site.

## Deploy to GitHub Pages

The workflow at `.github/workflows/deploy.yml` deploys the repository to GitHub Pages whenever code is pushed to `main` (or when manually run). It does not need Firebase Actions secrets or variables. In **Settings → Pages**, set the build and deployment source to **GitHub Actions**. After a successful workflow run, the deployment summary includes the site URL.

## Firebase configuration and security

The Firebase web `apiKey` identifies the Firebase project; it is not an admin credential and cannot replace Firebase Authentication or Firestore Rules. The Firebase web config in `script.js` is public and readable from the deployed site. Do not put service account JSON, Admin SDK private keys, webhook secrets, or paid third-party API secrets in this frontend or in GitHub Pages build variables.

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

`.env` files are ignored by Git, but GitHub Pages does not read them. Removing a value from the current files does not erase old commits. Since the Firebase web key is public by design, restrict it in Google Cloud Console; if a true private credential was committed, revoke/rotate it and clean repository history separately.

## Data notes

Attendance, course, calendar, semester, and event data use browser local storage. Signed-in attendance data can sync to the app’s Firestore user document. Events remain device-local and are not synced across devices. Clearing browser storage removes local-only data; export or preserve it before clearing browser data.
