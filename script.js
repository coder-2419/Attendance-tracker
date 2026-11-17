// ==========================================
// 1. FIREBASE INITIALIZATION WITH FAILSAFE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDfzYCLN2b4SNsUPBL9CqPIWcSTH2WCt9c",
  authDomain: "attendance-tracker-2fe63.firebaseapp.com",
  projectId: "attendance-tracker-2fe63",
  storageBucket: "attendance-tracker-2fe63.firebasestorage.app",
  messagingSenderId: "266695080777",
  appId: "1:266695080777:web:a84408e4b87b9e37f77898"
};

let auth = null;
let db = null;

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
  }
} catch (e) {
  console.warn("Firebase offline or placeholder credentials detected:", e);
}

let currentUser = null;
let userRole = 'student'; // 'student' or 'admin'
let userDocUnsubscribe = null;

function setAppLocked(locked) {
  document.body.classList.toggle('auth-locked', locked);
  document.querySelectorAll('.header, .settings-overlay, .overlay, .sidebar, #clockModalOverlay, .split-screen-overlay, .main-content, .bottom-nav')
    .forEach(element => { element.inert = locked; });
}

function requireSignedIn() {
  if (currentUser) return true;
  setAppLocked(true);
  openModal('authModal');
  return false;
}

function showFirstRunManual() {
  if (!currentUser || localStorage.getItem(MANUAL_SHOWN_KEY)) return;
  localStorage.setItem(MANUAL_SHOWN_KEY, 'true');
  setTimeout(() => { if (currentUser) openModal('userManual'); }, 300);
}

let authMode = 'signin'; 

const DB_KEY = 'attendance_tracker_v43'; 
const HISTORY_KEY = 'attendance_history_v43';
const CALENDAR_KEY = 'academic_calendar_v43';
const MARKED_DATES_KEY = 'marked_dates_v43';
const EVENTS_KEY = 'attendance_events_v1';
const MANUAL_SHOWN_KEY = 'appManualShown_v43';
const CUSTOM_DEFAULT_SCHEDULE_KEY = 'custom_default_timetable_v43';
const SEMESTER_KEY = 'attendance_active_semester_v1';
const SEMESTERS_KEY = 'attendance_semester_archive_v1';
let currentSemester = localStorage.getItem(SEMESTER_KEY) || 'Sem 1';
let cloudSaveQueue = Promise.resolve();
let cloudSyncNoticeTimer = null;

function pendingSyncKey(uid) {
  return `attendance_pending_sync_v1_${uid}`;
}

function showCloudSyncNotice(message) {
  let notice = document.getElementById('cloudSyncNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'cloudSyncNotice';
    notice.className = 'cloud-sync-notice';
    notice.setAttribute('role', 'status');
    document.body.appendChild(notice);
  }
  notice.textContent = message;
  notice.classList.add('visible');
  clearTimeout(cloudSyncNoticeTimer);
  cloudSyncNoticeTimer = setTimeout(() => notice.classList.remove('visible'), 8000);
}

function applyUserDataToApp(data) {
  if (Array.isArray(data.courses)) courses = data.courses;
  if (Array.isArray(data.historyLog)) historyLog = data.historyLog;
  if (Array.isArray(data.markedDates)) markedDates = data.markedDates;
  if ('academicCalendar' in data) academicCalendar = data.academicCalendar || null;
  if ('targetPercentage' in data) targetPercentage = data.targetPercentage || null;
  if (data.dailyMarks && typeof data.dailyMarks === 'object') {
    localStorage.setItem('daily_marks_v41', JSON.stringify(data.dailyMarks));
  }
  if (data.semesterArchive && typeof data.semesterArchive === 'object') {
    localStorage.setItem(SEMESTERS_KEY, JSON.stringify(data.semesterArchive));
  }
  if (data.currentSemester) {
    currentSemester = data.currentSemester;
    localStorage.setItem(SEMESTER_KEY, currentSemester);
  }
  if (data.defaultTimetable && typeof data.defaultTimetable === 'object') {
    localStorage.setItem(CUSTOM_DEFAULT_SCHEDULE_KEY, JSON.stringify(data.defaultTimetable));
  }
  if (Array.isArray(data.manualHolidays)) restoreManualHolidayOverrides(data.manualHolidays);

  localStorage.setItem(DB_KEY, JSON.stringify(courses));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyLog));
  localStorage.setItem(MARKED_DATES_KEY, JSON.stringify(markedDates));
  if (academicCalendar) localStorage.setItem(CALENDAR_KEY, JSON.stringify(academicCalendar));
  else localStorage.removeItem(CALENDAR_KEY);
  if (targetPercentage) localStorage.setItem('target_percentage', targetPercentage);
  else localStorage.removeItem('target_percentage');
}

function readDailyMarks() {
  try { return JSON.parse(localStorage.getItem('daily_marks_v41') || '{}'); }
  catch { return {}; }
}

function getManualHolidayOverrides() {
  return Object.keys(localStorage)
    .filter(key => key.startsWith('holiday_') && localStorage.getItem(key) === 'true')
    .map(key => key.slice('holiday_'.length));
}

function restoreManualHolidayOverrides(dates = []) {
  Object.keys(localStorage)
    .filter(key => key.startsWith('holiday_'))
    .forEach(key => localStorage.removeItem(key));
  dates.forEach(date => localStorage.setItem(`holiday_${date}`, 'true'));
}

let currentTab = 'courses';
let isEditingTimetable = false;
let inlineEditSchedule = [];
let inlineEditSchedules = {};

let clockTargetIndex = null;
let clockTargetField = null;
let clockCurrentHour = 9;
let clockCurrentMinute = 0;
let clockCurrentAmPm = 'AM';
let clockCurrentView = 'hours';

let targetPercentage = parseInt(localStorage.getItem('target_percentage'), 10) || null;
let historyLog = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let academicCalendar = JSON.parse(localStorage.getItem(CALENDAR_KEY)) || null;
let markedDates = JSON.parse(localStorage.getItem(MARKED_DATES_KEY)) || [];
let events = JSON.parse(localStorage.getItem(EVENTS_KEY)) || [];
let eventStatusFilter = 'All';
let eventCategoryFilter = 'All';
let eventSortOrder = 'asc';

let appPromptQueue = [];
let activeAppPrompt = null;
let activePromptReturnFocus = null;

function showAppPrompt(options = {}) {
  return new Promise(resolve => {
    appPromptQueue.push({ options, resolve });
    renderNextAppPrompt();
  });
}

function showAppAlert(message, title = 'Notice') {
  return showAppPrompt({
    kind: 'alert',
    title,
    message: String(message ?? ''),
    confirmText: 'Got it',
    cancelText: ''
  });
}

function renderNextAppPrompt() {
  if (activeAppPrompt || !appPromptQueue.length) return;
  const entry = appPromptQueue.shift();
  const { options, resolve } = entry;
  const overlay = document.getElementById('appPromptOverlay');
  if (!overlay) {
    resolve(false);
    return;
  }

  activeAppPrompt = { resolve, options };
  activePromptReturnFocus = document.activeElement;
  const isAlert = options.kind === 'alert';
  const icon = options.icon || (options.tone === 'danger'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg>'
    : isAlert
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/><path d="M12 11v5m0-8h.01"/></svg>');
  const title = options.title || (isAlert ? 'Notice' : 'Confirm this change');
  const confirmText = options.confirmText || (isAlert ? 'Got it' : 'Continue');
  const cancelText = options.cancelText === undefined ? 'Cancel' : options.cancelText;

  overlay.innerHTML = `
    <section class="app-prompt-card ${options.tone === 'danger' ? 'is-danger' : ''}"
      role="alertdialog" aria-modal="true" aria-labelledby="appPromptTitle"
      aria-describedby="appPromptMessage" tabindex="-1">
      <div class="app-prompt-icon" aria-hidden="true">${icon}</div>
      <h2 id="appPromptTitle">${escapeEventText(title)}</h2>
      <p id="appPromptMessage">${escapeEventText(options.message || '')}</p>
      <div class="app-prompt-actions">
        ${cancelText ? `<button type="button" class="app-prompt-secondary" data-prompt-cancel>${escapeEventText(cancelText)}</button>` : ''}
        <button type="button" class="app-prompt-primary" data-prompt-confirm>${escapeEventText(confirmText)}</button>
      </div>
    </section>`;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('scroll-locked');
  overlay.onclick = event => {
    if (event.target === overlay) closeAppPrompt(isAlert);
  };
  overlay.querySelector('[data-prompt-cancel]')?.addEventListener('click', () => closeAppPrompt(false));
  overlay.querySelector('[data-prompt-confirm]')?.addEventListener('click', () => closeAppPrompt(true));
  overlay.onkeydown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAppPrompt(isAlert);
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('button:not([disabled])')];
    if (!controls.length) return;
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault(); controls[controls.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
      event.preventDefault(); controls[0].focus();
    }
  };
  const initialFocus = options.tone === 'danger' && cancelText
    ? overlay.querySelector('[data-prompt-cancel]')
    : overlay.querySelector('[data-prompt-confirm]');
  initialFocus?.focus();
}

function closeAppPrompt(result) {
  if (!activeAppPrompt) return;
  const { resolve } = activeAppPrompt;
  const overlay = document.getElementById('appPromptOverlay');
  activeAppPrompt = null;
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '';
    overlay.onclick = null;
    overlay.onkeydown = null;
  }
  const otherOverlayOpen = ['modalOverlay', 'clockModalOverlay', 'settingsOverlay', 'splitScreenOverlay']
    .some(id => document.getElementById(id)?.classList.contains('active'));
  if (!otherOverlayOpen) document.body.classList.remove('scroll-locked');
  resolve(result);
  if (activePromptReturnFocus?.isConnected) activePromptReturnFocus.focus();
  activePromptReturnFocus = null;
  queueMicrotask(renderNextAppPrompt);
}

// Route any remaining legacy alert() call sites through the same in-app surface.
window.alert = message => showAppAlert(message);

async function confirmDataChange(action, syncsToCloud = false) {
  const destination = syncsToCloud && currentUser
    ? 'This will be saved on this device and synced to your account.'
    : 'This will be saved on this device.';
  const isDestructive = /delete|remove|reset|clear/i.test(action);
  const confirmText = /delete/i.test(action) ? 'Delete' : /remove/i.test(action) ? 'Remove' : isDestructive ? 'Reset' : 'Continue';
  return showAppPrompt({
    kind: 'confirm',
    title: 'Confirm this change',
    message: `${action}. ${destination}`,
    confirmText,
    cancelText: 'Cancel',
    tone: isDestructive ? 'danger' : 'neutral'
  });
}

function getTodayString() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

let currentSelectedDay = getTodayString();
let currentCalDate = new Date(); 

if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
  document.querySelectorAll('.theme-toggle-wrapper[aria-pressed]').forEach(toggle => toggle.setAttribute('aria-pressed', 'true'));
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark);
  document.querySelectorAll('.theme-toggle-wrapper[aria-pressed]').forEach(toggle => toggle.setAttribute('aria-pressed', String(isDark)));
}

function getTodayDateString() {
  const now = new Date(); 
  return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

const masterScheduleMap = {};

function getActiveDefaultSchedule() {
  const custom = localStorage.getItem(CUSTOM_DEFAULT_SCHEDULE_KEY);
  if (custom) {
    try { return JSON.parse(custom); } catch(e){}
  }
  return masterScheduleMap;
}

function buildInitialDatabase() {
  const savedDefault = getActiveDefaultSchedule();
  return Object.entries(savedDefault).map(([code, item]) => ({
    id: Date.now() + Math.random(),
    name: item.name || code,
    code,
    present: 0,
    absent: 0,
    schedule: JSON.parse(JSON.stringify(item.schedule || {}))
  }));
}

function loadFromDatabase() {
  const storedData = localStorage.getItem(DB_KEY);
  if (storedData) return JSON.parse(storedData);
  const defaultData = buildInitialDatabase();
  localStorage.setItem(DB_KEY, JSON.stringify(defaultData));
  return defaultData;
}

let courses = loadFromDatabase();

function snapshotSemester() {
  const archive = JSON.parse(localStorage.getItem(SEMESTERS_KEY) || '{}');
  archive[currentSemester] = { courses, dailyMarks: JSON.parse(localStorage.getItem('daily_marks_v41') || '{}'), markedDates, academicCalendar, targetPercentage };
  localStorage.setItem(SEMESTERS_KEY, JSON.stringify(archive));
}

async function loadSemester(name) {
  if (name === currentSemester) return;
  if (!(await confirmDataChange(`Switch to ${name}`, true))) return;
  snapshotSemester();
  const archive = JSON.parse(localStorage.getItem(SEMESTERS_KEY) || '{}');
  currentSemester = name;
  localStorage.setItem(SEMESTER_KEY, name);
  const data = archive[name] || { courses: [], dailyMarks: {}, markedDates: [], academicCalendar: null, targetPercentage: null };
  courses = data.courses || [];
  markedDates = data.markedDates || [];
  academicCalendar = data.academicCalendar || null;
  targetPercentage = data.targetPercentage || null;
  localStorage.setItem(DB_KEY, JSON.stringify(courses));
  localStorage.setItem('daily_marks_v41', JSON.stringify(data.dailyMarks || {}));
  localStorage.setItem(MARKED_DATES_KEY, JSON.stringify(markedDates));
  if (academicCalendar) localStorage.setItem(CALENDAR_KEY, JSON.stringify(academicCalendar)); else localStorage.removeItem(CALENDAR_KEY);
  saveToDatabase();
  renderUI();
  openSettingsTab('semesters');
}

async function createTimetableShare() {
  if (!db) return alert('Cloud connection is unavailable.');
  if (!(await confirmDataChange('Create a share code that publishes your timetable to Cloud Firestore', true))) return;
  const code = `TT-${Math.floor(1000 + Math.random() * 9000)}`;
  const schedule = courses.map(({name,code:courseCode,schedule})=>({name,code:courseCode || '',schedule:schedule || {}}));
  try { await db.collection('shared_timetables').doc(code).set({schedule,createdAt:firebase.firestore.FieldValue.serverTimestamp()}); document.getElementById('timetableShareCode').textContent=code; }
  catch(err) { alert(`Could not create share code: ${err.message}`); }
}

async function importTimetable(mode) {
  if (!db) return alert('Cloud connection is unavailable.');
  const code = document.getElementById('timetableImportCode').value.trim().toUpperCase();
  if (!/^TT-\d{4}$/.test(code)) return alert('Enter a code like TT-4821.');
  try {
    const doc = await db.collection('shared_timetables').doc(code).get();
    if (!doc.exists) return alert('Timetable code not found.');
    const incoming = doc.data().schedule || [];
    if (!(await confirmDataChange(`${mode === 'merge' ? 'Merge' : 'Replace'} your timetable using the shared schedule`, true))) return;
    if (mode === 'replace') courses = [];
    incoming.forEach(item => {
      let course = mode === 'merge' && courses.find(c => c.name.toLowerCase() === item.name.toLowerCase());
      if (course) course.schedule = {...(course.schedule || {}), ...(item.schedule || {})};
      else courses.push({id:Date.now()+Math.random(),name:item.name,code:item.code || 'SHARED',present:0,absent:0,schedule:item.schedule || {}});
    });
    saveToDatabase(); snapshotSemester(); renderUI(); alert(`Timetable ${mode === 'merge' ? 'merged' : 'replaced'}.`);
  } catch(err) { alert(`Could not import timetable: ${err.message}`); }
}

// ==========================================
// 3. CLOUD FIRESTORE & AUTH STATE
// ==========================================
function saveToDatabase() {
  localStorage.setItem(DB_KEY, JSON.stringify(courses));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyLog));
  localStorage.setItem(MARKED_DATES_KEY, JSON.stringify(markedDates));
  localStorage.setItem(SEMESTER_KEY, currentSemester);
  snapshotSemester();

  if (currentUser && db) {
    const uid = currentUser.uid;
    const snapshot = JSON.parse(JSON.stringify({
      email: currentUser.email,
      courses: courses,
      historyLog: historyLog,
      markedDates: markedDates,
      academicCalendar: academicCalendar,
      targetPercentage: targetPercentage,
      dailyMarks: readDailyMarks(),
      semesterArchive: JSON.parse(localStorage.getItem(SEMESTERS_KEY) || '{}'),
      currentSemester: currentSemester,
      defaultTimetable: JSON.parse(localStorage.getItem(CUSTOM_DEFAULT_SCHEDULE_KEY) || '{}'),
      manualHolidays: getManualHolidayOverrides()
    }));
    const payload = {
      ...snapshot,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    const pendingKey = pendingSyncKey(uid);
    // Keep a per-account outbox until Firestore confirms the write. If a refresh
    // happens while offline or rules reject the write, the newest edit survives.
    localStorage.setItem(pendingKey, JSON.stringify(snapshot));
    // Serialize writes so rapid attendance taps cannot finish out of order and
    // replace a newer snapshot with an older one.
    cloudSaveQueue = cloudSaveQueue.catch(() => {}).then(() =>
      db.collection('users').doc(uid).set(payload, { merge: true })
    ).then(() => {
      if (localStorage.getItem(pendingKey) === JSON.stringify(snapshot)) {
        localStorage.removeItem(pendingKey);
      }
    }).catch(err => {
      console.error('Cloud save failed:', err);
      showCloudSyncNotice(`Saved on this device, but cloud sync failed (${err.code || err.message}). Your edit is queued to retry.`);
    });
  }
}

function addHistory(action) {
  const now = new Date();
  const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  historyLog.unshift({ time: timestamp, action });
  if (historyLog.length > 50) historyLog.pop(); 
  saveToDatabase();
}

if (auth) {
  auth.onAuthStateChanged(async (user) => {
    const authMenuItem = document.getElementById('authMenuItem');
    if (userDocUnsubscribe) {
      userDocUnsubscribe();
      userDocUnsubscribe = null;
    }

    if (user) {
      currentUser = user;
      setAppLocked(true);
      if (authMenuItem) authMenuItem.innerHTML = `👤 ${user.displayName || user.email.split('@')[0]}`;
      await loadUserDataFromFirestore(user.uid);
      listenToUserDocRealtime(user.uid);
      setAppLocked(false);
      
      const modalContent = document.getElementById('modalContent');
      const modalOverlay = document.getElementById('modalOverlay');
      if (modalOverlay && modalOverlay.classList.contains('active') && modalContent && modalContent.classList.contains('auth-modal-card')) {
        forceCloseModal();
      }
    } else {
      currentUser = null;
      userRole = 'student';
      setAppLocked(true);
      if (authMenuItem) authMenuItem.innerHTML = `🔑 Sign In / Account`;
      openModal('authModal');
    }
    
    renderUI();
    showFirstRunManual();
  });
} else {
  setAppLocked(true);
  openModal('authModal');
}

function listenToUserDocRealtime(uid) {
  if (!db) return;
  userDocUnsubscribe = db.collection('users').doc(uid).onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      userRole = data.role === 'admin' ? 'admin' : 'student';
    }
  });
}

async function loadUserDataFromFirestore(uid) {
  if (!db) return;
  try {
    const userDocRef = db.collection('users').doc(uid);
    const doc = await userDocRef.get();

    const pendingKey = pendingSyncKey(uid);
    const pendingData = localStorage.getItem(pendingKey);
    if (pendingData) {
      const localChanges = JSON.parse(pendingData);
      applyUserDataToApp(localChanges);
      userRole = doc.exists && doc.data().role === 'admin' ? 'admin' : 'student';
      const retryPayload = doc.exists
        ? { ...localChanges, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }
        : {
            ...localChanges,
            displayName: currentUser.displayName || '',
            role: 'student',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
      try {
        await userDocRef.set(retryPayload, { merge: doc.exists });
        if (localStorage.getItem(pendingKey) === pendingData) localStorage.removeItem(pendingKey);
      } catch (err) {
        console.error('Queued Firestore sync failed:', err);
        showCloudSyncNotice(`Your saved edits are still on this device. Cloud sync failed (${err.code || err.message}); check Firestore rules and connection.`);
      }
      return;
    }

    if (doc.exists) {
      const data = doc.data();
      userRole = data.role === 'admin' ? 'admin' : 'student';
      applyUserDataToApp(data);
      if (data.dailyMarks) {
        const archive = JSON.parse(localStorage.getItem(SEMESTERS_KEY) || '{}');
        if (!archive[currentSemester]) snapshotSemester();
      }
    } else {
      await userDocRef.set({
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        role: 'student',
        courses: courses,
        historyLog: historyLog,
        markedDates: markedDates,
        academicCalendar: academicCalendar,
        targetPercentage: targetPercentage,
        dailyMarks: readDailyMarks(),
        semesterArchive: JSON.parse(localStorage.getItem(SEMESTERS_KEY) || '{}'),
        currentSemester: currentSemester,
        defaultTimetable: JSON.parse(localStorage.getItem(CUSTOM_DEFAULT_SCHEDULE_KEY) || '{}'),
        manualHolidays: getManualHolidayOverrides(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Firestore sync error:", err);
    showCloudSyncNotice(`Could not load your cloud data (${err.code || err.message}). This device’s saved data is still available.`);
  }
}

// ==========================================
// Unconditional Modal Closer
function forceCloseModal() {
  if (!currentUser && document.getElementById('modalContent')?.classList.contains('auth-modal-card')) return;
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
    modalOverlay.style.removeProperty('display');
  }
  const modalContent = document.getElementById('modalContent');
  if (modalContent) {
    modalContent.className = 'modal-content';
    modalContent.innerHTML = '';
  }
  const settingsShowing = document.getElementById('settingsOverlay')?.classList.contains('active');
  if (!settingsShowing) document.body.classList.remove('scroll-locked');
}

function closeModal(e) {
  if (!currentUser && document.getElementById('modalContent')?.classList.contains('auth-modal-card')) return;
  if (e && e.target && e.target !== document.getElementById('modalOverlay') && !e.target.closest('.close-btn')) return;
  forceCloseModal();
}

// ==========================================
// 6. INTERACTIVE CLOCK PICKER
// ==========================================
function openClockPicker(index, field) {
  clockTargetIndex = index;
  clockTargetField = field;
  const [h, m] = (inlineEditSchedule[index][field] || '09:00').split(':').map(Number);
  clockCurrentAmPm = h >= 12 ? 'PM' : 'AM';
  clockCurrentHour = h % 12 || 12;
  clockCurrentMinute = m || 0;
  clockCurrentView = 'hours';
  document.getElementById('clockPickerTitle').innerText = field === 'start' ? 'Set Start Time' : 'Set End Time';
  document.getElementById('clockModalOverlay').classList.add('active');
  document.body.classList.add('scroll-locked');
  updateClockDisplay();
  renderClockDial();
}

function closeClockPicker() {
  const clockModal = document.getElementById('clockModalOverlay');
  if (clockModal) clockModal.classList.remove('active');
  
  const settingsShowing = document.getElementById('settingsOverlay')?.classList.contains('active');
  if (!settingsShowing) {
    document.body.classList.remove('scroll-locked');
  }
}

function setClockAmPm(ampm) {
  clockCurrentAmPm = ampm;
  document.getElementById('clockAmBtn').classList.toggle('active', ampm === 'AM');
  document.getElementById('clockPmBtn').classList.toggle('active', ampm === 'PM');
}

function setClockView(view) {
  clockCurrentView = view;
  document.getElementById('clockHourDisplay').classList.toggle('active-part', view === 'hours');
  document.getElementById('clockMinuteDisplay').classList.toggle('active-part', view === 'minutes');
  renderClockDial();
}

function updateClockDisplay() {
  document.getElementById('clockHourDisplay').innerText = String(clockCurrentHour).padStart(2, '0');
  document.getElementById('clockMinuteDisplay').innerText = String(clockCurrentMinute).padStart(2, '0');
  document.getElementById('clockAmBtn').classList.toggle('active', clockCurrentAmPm === 'AM');
  document.getElementById('clockPmBtn').classList.toggle('active', clockCurrentAmPm === 'PM');
}

function renderClockDial() {
  const container = document.getElementById('clockNumbers');
  container.innerHTML = '';
  const dial = document.getElementById('clockDial');
  const size = dial.clientWidth;
  const radius = size * 0.36;
  const cx = size / 2, cy = size / 2;
  const hand = document.getElementById('clockHand');

  if (clockCurrentView === 'hours') {
    const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    hours.forEach(h => {
      const angle = (h * 30 - 90) * (Math.PI / 180);
      const x = cx + radius * Math.cos(angle) - 18;
      const y = cy + radius * Math.sin(angle) - 18;

      const el = document.createElement('div');
      el.className = `clock-number-item ${clockCurrentHour === h ? 'selected' : ''}`;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.innerText = h;
      el.onclick = () => {
        clockCurrentHour = h;
        updateClockDisplay();
        renderClockDial();
        setTimeout(() => setClockView('minutes'), 180);
      };
      container.appendChild(el);
    });
    hand.style.height = `${radius}px`;
    hand.style.transform = `rotate(${clockCurrentHour * 30}deg)`;
  } else {
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    minutes.forEach(m => {
      const angle = (m * 6 - 90) * (Math.PI / 180);
      const x = cx + radius * Math.cos(angle) - 18;
      const y = cy + radius * Math.sin(angle) - 18;

      const el = document.createElement('div');
      el.className = `clock-number-item ${clockCurrentMinute === m ? 'selected' : ''}`;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.innerText = String(m).padStart(2, '0');
      el.onclick = () => {
        clockCurrentMinute = m;
        updateClockDisplay();
        renderClockDial();
      };
      container.appendChild(el);
    });
    hand.style.height = `${radius}px`;
    hand.style.transform = `rotate(${clockCurrentMinute * 6}deg)`;
  }

  if (!dial.dataset.dragReady) {
    dial.dataset.dragReady = 'true';
    const chooseFromPointer = (event) => {
      if (!dial.hasPointerCapture?.(event.pointerId) && event.type === 'pointermove') return;
      const rect = dial.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      let degrees = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      if (clockCurrentView === 'hours') {
        let hour = Math.round(degrees / 30) % 12;
        clockCurrentHour = hour || 12;
      } else {
        clockCurrentMinute = (Math.round(degrees / 6 / 5) * 5) % 60;
      }
      updateClockDisplay();
      renderClockDial();
    };
    dial.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      dial.setPointerCapture(event.pointerId);
      chooseFromPointer(event);
    });
    dial.addEventListener('pointermove', (event) => {
      if (dial.hasPointerCapture(event.pointerId)) chooseFromPointer(event);
    });
  }
}

function confirmClockTime() {
  let h = clockCurrentHour % 12;
  if (clockCurrentAmPm === 'PM') h += 12;
  const time24 = `${String(h).padStart(2, '0')}:${String(clockCurrentMinute).padStart(2, '0')}`;
  
  if (clockTargetIndex !== null && clockTargetField) {
    inlineEditSchedule[clockTargetIndex][clockTargetField] = time24;
  }
  
  closeClockPicker();
  renderUI();
}

// ==========================================
// 7. TIMETABLE EDITING & POPUPS
// ==========================================
function showVirtualPopup({ icon = '📋', title, message, confirmText = '✓ Save', cancelText = '✖ No', onConfirm, onCancel }) {
  const isDanger = /reset|clear|delete/i.test(title);
  const iconMarkup = isDanger
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg>'
    : /default/i.test(title)
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v15H4zM8 3v4m8-4v4M4 10h16"/><path d="m9 15 2 2 4-4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h11l4 4v14H5zM8 3v6h9V3M8 21v-8h9v8"/></svg>';
  showAppPrompt({
    kind: 'confirm',
    icon: iconMarkup,
    title,
    message: message.replace(/<\/?b>/g, ''),
    confirmText,
    cancelText: cancelText || 'Cancel',
    tone: isDanger ? 'danger' : 'neutral'
  }).then(accepted => {
    if (accepted) onConfirm?.();
    else onCancel?.();
  });
}

function toggleTimetableEdit() {
  if (isEditingTimetable) {
    inlineEditSchedules[currentSelectedDay] = inlineEditSchedule;
    for (const [day, schedule] of Object.entries(inlineEditSchedules)) for (let p of schedule) {
      if(!p.start || !p.end || !p.name.trim()) {
        return alert(`Please fill all time and course name fields completely for ${day}.`);
      }
      if(p.start >= p.end) {
        return alert(`Start time must be before end time for ${p.name || 'period'} on ${day}.`);
      }
    }

    showVirtualPopup({
      icon: '💾',
      title: 'Save Timetable Changes?',
      message: `Disclaimer: Saving will update the timetable on this device${currentUser ? ' and sync it to your account' : ''}. Do you want to continue?`,
      confirmText: 'Save changes',
      cancelText: 'Cancel',
      onConfirm: () => {
        setTimeout(() => {
          showVirtualPopup({
            icon: '⚙️',
            title: 'Update Default Timetable?',
            message: `Do you also want to save this as the <b>default timetable</b>? (This will be restored if you click "Reset Default Timetable").`,
            confirmText: 'Save as default',
            cancelText: 'No thanks',
            onConfirm: () => saveInlineTimetable(true),
            onCancel: () => saveInlineTimetable(false)
          });
        }, 200);
      }
    });

  } else {
    isEditingTimetable = true;
    inlineEditSchedules = {};
    inlineEditSchedule = getScheduleForDay(currentSelectedDay);
    renderUI();
  }
}

function getScheduleForDay(dayName) {
  const schedule = [];
  courses.forEach(c => {
    (c.schedule && c.schedule[dayName] || []).forEach(slot => {
      schedule.push({ start: slot.start, end: slot.end, code: c.code, name: c.name, id: c.id });
    });
  });
  return schedule.sort((a,b) => a.start.localeCompare(b.start));
}

function addInlinePeriod() {
  inlineEditSchedule.push({ start: '', end: '', code: '', name: '' });
  renderUI();
}

function updateInlinePeriod(index, field, value) {
  inlineEditSchedule[index][field] = value;
}

function removeInlinePeriod(index) {
  inlineEditSchedule.splice(index, 1);
  renderUI();
}

function saveInlineTimetable(setAsDefault) {
  inlineEditSchedules[currentSelectedDay] = inlineEditSchedule;
  Object.entries(inlineEditSchedules).forEach(([day, schedule]) => {
  courses.forEach(c => {
      if (c.schedule && c.schedule[day]) {
          delete c.schedule[day];
      }
  });
  
  schedule.forEach(p => {
      let course = courses.find(c => c.name.trim().toUpperCase() === p.name.trim().toUpperCase());
      if (!course) {
          course = { id: Date.now() + Math.random(), name: p.name.trim(), code: p.code || 'CUSTOM', present: 0, absent: 0, schedule: {} };
          courses.push(course);
      }
      if (!course.schedule) course.schedule = {};
      if (!course.schedule[day]) course.schedule[day] = [];
      course.schedule[day].push({ start: p.start, end: p.end });
  });
  });

  if (setAsDefault) {
    let currentMap = {};
    courses.forEach(c => {
      currentMap[c.code || c.name] = {
        name: c.name,
        schedule: JSON.parse(JSON.stringify(c.schedule || {}))
      };
    });
    localStorage.setItem(CUSTOM_DEFAULT_SCHEDULE_KEY, JSON.stringify(currentMap));
  }
  
  addHistory(`Updated timetable for ${currentSelectedDay}${setAsDefault ? ' (Set as default)' : ''}`);
  saveToDatabase();
  isEditingTimetable = false;
  renderUI();
}

function resetToDefaultTimetable() {
  showVirtualPopup({
    icon: '⚠️',
    title: 'Reset Default Timetable?',
    message: `Disclaimer: This will clear your attendance logs and restore the default timetable on this device${currentUser ? ' and sync the changes to your account' : ''}. Continue?`,
    confirmText: 'Reset timetable',
    cancelText: 'Cancel',
    onConfirm: () => {
      courses = buildInitialDatabase();
      markedDates = [];
      historyLog = [];
      localStorage.removeItem('daily_marks_v41'); 
      addHistory("Reset to default timetable.");
      saveToDatabase();
      renderUI();
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('menuOverlay').classList.remove('active');
      document.body.classList.remove('scroll-locked');
    }
  });
}

// ==========================================
// 8. ATTENDANCE MATH & LIVE LOGGING
// ==========================================
function format12Hour(time24) {
  if (!time24 || time24 === '--:--') return '--:--';
  let [hours, minutes] = time24.split(':');
  hours = parseInt(hours, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function startLiveClock() {
  const clockElement = document.getElementById('liveClock');
  if (!clockElement) return;
  setInterval(() => {
    const now = new Date();
    clockElement.innerHTML = `
      <div class="clock-time">${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
      <div class="clock-date">${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
    `;
  }, 1000);
}

function isTodayHoliday() { 
  const todayStr = getTodayDateString();
  const manualHoliday = localStorage.getItem('holiday_' + todayStr) === 'true';
  const calendarHoliday = academicCalendar && academicCalendar.holidays && academicCalendar.holidays.includes(todayStr);
  return manualHoliday || calendarHoliday; 
}

async function toggleHoliday() {
  if (getTodayString() === 'Sunday') return; 
  const todayStr = getTodayDateString();
  if (!(await confirmDataChange('Change today’s holiday status', true))) return;
  if (localStorage.getItem('holiday_' + todayStr) === 'true') localStorage.removeItem('holiday_' + todayStr);
  else localStorage.setItem('holiday_' + todayStr, 'true');
  saveToDatabase();
  updateHolidayButton(); 
  renderUI(); 
}

function updateHolidayButton() {
  const btn = document.getElementById('holidayBtn');
  if (!btn) return;
  const todayStr = getTodayDateString();
  
  if (getTodayString() === 'Sunday') {
    btn.classList.add('active');
    btn.innerText = 'SUNDAY - HOLIDAY';
    btn.style.pointerEvents = 'none'; 
  } else if (localStorage.getItem('holiday_' + todayStr) === 'true' || (academicCalendar && academicCalendar.holidays && academicCalendar.holidays.includes(todayStr))) { 
    btn.classList.add('active'); 
    btn.innerText = 'HOLIDAY ACTIVE'; 
    btn.style.pointerEvents = 'auto';
  } else { 
    btn.classList.remove('active'); 
    btn.innerText = 'Mark Today Holiday'; 
    btn.style.pointerEvents = 'auto';
  }
}

function getCalculatedAttendance() {
  let calc = {};
  courses.forEach(c => calc[c.id] = { p: 0, a: 0 });
  let dailyMarks = JSON.parse(localStorage.getItem('daily_marks_v41')) || {};

  if (academicCalendar && academicCalendar.startDate) {
    let currDate = new Date(academicCalendar.startDate + 'T00:00:00');
    let endDate = new Date(getTodayDateString() + 'T00:00:00');

    if (academicCalendar.endDate) {
      let termEnd = new Date(academicCalendar.endDate + 'T00:00:00');
      if (termEnd < endDate) endDate = termEnd;
    }

    const now = new Date();
    const nowStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const todayStr = getTodayDateString();

    while (currDate <= endDate) {
      const y = currDate.getFullYear();
      const m = String(currDate.getMonth() + 1).padStart(2, '0');
      const d = String(currDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[currDate.getDay()];

      const isHoliday = (currDate.getDay() === 0) || 
                        (academicCalendar.holidays && academicCalendar.holidays.includes(dateStr)) || 
                        (localStorage.getItem('holiday_' + dateStr) === 'true');
      const isFullDayMarked = markedDates.includes(dateStr);
      const isToday = (dateStr === todayStr);

      if (!isHoliday) {
        courses.forEach(course => {
          if (course.schedule && course.schedule[dayName]) {
            course.schedule[dayName].forEach(slot => {
              const slotKey = `${dateStr}_${course.id}_${slot.start}`;
              const slotMark = dailyMarks[slotKey];

              if (slotMark === 'cancelled') {
                // Cancelled sessions do not contribute to attendance totals.
                return;
              } else if (isFullDayMarked) {
                calc[course.id].p += 1;
              } else if (slotMark === 'present') {
                calc[course.id].p += 1;
              } else if (slotMark === 'absent') {
                calc[course.id].a += 1;
              } else {
                if (!isToday) {
                  calc[course.id].a += 1;
                } else if (nowStr > slot.end) { 
                  calc[course.id].a += 1;
                }
              }
            });
          }
        });
      }
      currDate.setDate(currDate.getDate() + 1);
    }
  }
  return calc;
}

function getBunkStatus(present, absent) {
  present = Math.max(0, parseInt(present, 10) || 0);
  absent = Math.max(0, parseInt(absent, 10) || 0);
  const total = present + absent;
  if (total === 0) return `<span class="bunk-meter" style="color:var(--text-sub);">No classes yet</span>`;

  if (!targetPercentage) {
    return `<span class="bunk-meter" style="color:var(--text-sub);">Set target % in menu</span>`;
  }

  const target = targetPercentage / 100;
  const currentPercent = (present / total) * 100;

  if (currentPercent >= targetPercentage) {
    const buffer = Math.floor(((present / target) - total) + 0.0001);
    return buffer > 0 
      ? `<span class="bunk-meter bunk-safe"><span class="status-label">Safe</span><strong class="bunk-count">${buffer}</strong> class${buffer > 1 ? 'es' : ''} to bunk</span>`
      : `<span class="bunk-meter bunk-safe"><span class="status-label">Safe</span>On track · 0 buffer</span>`;
  } else {
    if (target >= 1) return `<span class="bunk-meter bunk-danger">Cannot reach 100%</span>`;
    const required = Math.ceil((((target * total) - present) / (1 - target)) - 0.0001);
    const nearTarget = currentPercent >= targetPercentage - 5;
    const status = nearTarget ? 'Warning' : 'Critical';
    return `<span class="bunk-meter ${nearTarget ? 'bunk-warning' : 'bunk-danger'}"><span class="status-label">${status}</span>Attend next <strong class="bunk-count">${required}</strong> class${required > 1 ? 'es' : ''}</span>`;
  }
}

function toggleSlotAttendance(courseId, slotStart, clickedStatus) {
  const todayStr = getTodayDateString();
  const slotKey = `${todayStr}_${courseId}_${slotStart}`;
  let dailyMarks = JSON.parse(localStorage.getItem('daily_marks_v41')) || {};
  const currentStatus = dailyMarks[slotKey];
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  
  if (currentStatus === clickedStatus) {
    if (clickedStatus !== 'cancelled') return;
    delete dailyMarks[slotKey];
    localStorage.setItem('daily_marks_v41', JSON.stringify(dailyMarks));
    saveToDatabase();
    renderUI();
    return;
  }
  // The per-slot mark is the source of truth; aggregate counts are calculated
  // from it, so do not also mutate course.present/course.absent here.
  dailyMarks[slotKey] = clickedStatus;
  
  localStorage.setItem('daily_marks_v41', JSON.stringify(dailyMarks));
  saveToDatabase();
  checkAndAutoMarkDay(); 
  renderUI();
}

function finalizeMissedClasses() {
  const todayStr = getTodayDateString();
  const todayName = getTodayString();
  const now = new Date();
  const nowStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  if (todayName === 'Sunday' || isTodayHoliday()) return;

  const dailyMarks = JSON.parse(localStorage.getItem('daily_marks_v41')) || {};
  let changed = false;
  courses.forEach(course => {
    (course.schedule && course.schedule[todayName] || []).forEach(slot => {
      const slotKey = `${todayStr}_${course.id}_${slot.start}`;
      // Leave current and future periods open for attendance marking.
      if (!dailyMarks[slotKey] && nowStr >= slot.end) {
        dailyMarks[slotKey] = 'absent';
        changed = true;
      }
    });
  });
  if (changed) {
    localStorage.setItem('daily_marks_v41', JSON.stringify(dailyMarks));
    saveToDatabase();
  }
}

function checkAndAutoMarkDay() {
  const todayStr = getTodayDateString();
  const todayName = getTodayString();
  if (markedDates.includes(todayStr)) return; 

  let dailyMarks = JSON.parse(localStorage.getItem('daily_marks_v41')) || {};
  let allPresent = true;
  let totalClassesToday = 0;

  courses.forEach(c => {
    if (c.schedule && c.schedule[todayName]) {
      c.schedule[todayName].forEach(slot => {
        totalClassesToday++;
        const slotKey = `${todayStr}_${c.id}_${slot.start}`;
        if (dailyMarks[slotKey] !== 'present') allPresent = false;
      });
    }
  });

  if (totalClassesToday > 0 && allPresent) {
    markedDates.push(todayStr); 
    addHistory(`All classes attended! Auto-marked calendar for ${todayStr}.`);
    localStorage.setItem(MARKED_DATES_KEY, JSON.stringify(markedDates));
    
    courses.forEach(c => {
      if (c.schedule && c.schedule[todayName]) {
        c.schedule[todayName].forEach(slot => {
          delete dailyMarks[`${todayStr}_${c.id}_${slot.start}`];
        });
      }
    });
    localStorage.setItem('daily_marks_v41', JSON.stringify(dailyMarks));
    saveToDatabase();
  }
}

// ==========================================
// 9. TAB ROUTING & CORE UI RENDERER
// ==========================================
function switchTab(tab) {
  if (!requireSignedIn()) return;
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${tab}`).classList.add('active');
  if (tab === 'timetable') {
     currentSelectedDay = getTodayString(); 
     isEditingTimetable = false;
  }
  renderUI();
}

function renderEvents() {
  const host = document.getElementById('eventsSection');
  if (!host) return;
  const today = getTodayDateString();
  // Past events sit before today's banner in the carousel. Oldest-first DOM
  // ordering makes the nearest past event the first one reached by swiping right.
  const pastEvents = events.filter(e => e.date < today).sort((a,b) => a.date.localeCompare(b.date));
  const presentEvents = events.filter(e => e.date === today).sort((a,b) => a.title.localeCompare(b.title));
  const upcomingEvents = events.filter(e => e.date > today).sort((a,b) => a.date.localeCompare(b.date));
  const carouselEvents = [...pastEvents, ...presentEvents, ...upcomingEvents];
  const eventEmojis = {Exam:'📝',Assignment:'📚',Fest:'🎉',Holiday:'🌴',Personal:'✨',Club:'🎭'};
  const bannerMarkup = carouselEvents.length ? carouselEvents.map(item => {
    const delta = Math.round((new Date(`${item.date}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
    const label = delta < 0 ? `${Math.abs(delta)} days ago` : delta === 0 ? 'Happening today' : delta === 1 ? 'Tomorrow' : `In ${delta} days`;
    return `<button type="button" class="event-hero ${delta === 0 ? 'event-today' : delta < 0 ? 'event-past' : ''}" onclick="focusEvent('${escapeEventAttribute(item.id)}')" aria-label="${escapeEventAttribute(label)}: ${escapeEventAttribute(item.title)}"><span class="event-hero-icon">${eventEmojis[item.category] || '📅'}</span><span class="event-hero-copy"><small>${escapeEventText(label)}</small><strong>${escapeEventText(item.title)}</strong><span>${escapeEventText(item.date)} · ${escapeEventText(item.category)}</span></span><span class="event-hero-arrow">›</span></button>`;
  }).join('') : '<div class="event-hero event-empty"><span class="event-hero-icon">📅</span><span class="event-hero-copy"><small>PLAN AHEAD</small><strong>No events yet</strong><span>Add an event to see it here</span></span></div>';
  const visible = events
    .filter(item => eventStatusFilter === 'All' || (eventStatusFilter === 'Upcoming' ? item.date >= today : item.date < today))
    .filter(item => eventCategoryFilter === 'All' || item.category === eventCategoryFilter)
    .sort((a, b) => eventSortOrder === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));

  host.innerHTML = `<h2>Events</h2>
    <div class="event-carousel" aria-label="Events; swipe left for upcoming and right for past events">${bannerMarkup}</div>
    <form class="event-form" onsubmit="addEvent(event)">
      <input id="eventTitle" required maxlength="100" placeholder="Event title">
      <input id="eventDate" required type="date">
      <select id="eventCategory" aria-label="Event category"><option>Exam</option><option>Assignment</option><option>Fest</option><option>Holiday</option><option>Personal</option><option>Club</option></select>
      <button class="btn-present" type="submit">Add Event</button>
    </form>
    <div class="event-filters">
      <select aria-label="Filter by status" onchange="eventStatusFilter=this.value;renderEvents()"><option ${eventStatusFilter==='All'?'selected':''}>All</option><option ${eventStatusFilter==='Upcoming'?'selected':''}>Upcoming</option><option ${eventStatusFilter==='Past'?'selected':''}>Past</option></select>
      <select aria-label="Filter by category" onchange="eventCategoryFilter=this.value;renderEvents()"><option ${eventCategoryFilter==='All'?'selected':''}>All</option>${['Exam','Assignment','Fest','Holiday','Personal','Club'].map(c=>`<option ${eventCategoryFilter===c?'selected':''}>${c}</option>`).join('')}</select>
      <select aria-label="Sort events" onchange="eventSortOrder=this.value"><option value="asc" ${eventSortOrder==='asc'?'selected':''}>Date Ascending</option><option value="desc" ${eventSortOrder==='desc'?'selected':''}>Date Descending</option></select>
    </div>
    <div class="event-list">${visible.length ? visible.map(item=>`<article class="event-row"><span><b>${escapeEventText(item.title)}</b><br>${escapeEventText(item.date)} · ${escapeEventText(item.category)}</span><button type="button" aria-label="Remove ${escapeEventAttribute(item.title)}" onclick="deleteEvent('${escapeEventAttribute(item.id)}')">Remove</button></article>`).join('') : '<p>No events match these filters.</p>'}</div>`;
  const carousel = document.querySelector('.event-carousel');
  if (carousel && carouselEvents.length) {
    const currentIndex = pastEvents.length;
    requestAnimationFrame(() => { carousel.scrollLeft = currentIndex * carousel.clientWidth; });
    const cards = carousel.querySelectorAll('.event-hero');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      entry.target.classList.toggle('event-banner-visible', entry.isIntersecting);
    }), {root: carousel, threshold: .45});
    cards.forEach(card => observer.observe(card));
  }
}

function focusEvent(id) {
  const row = [...document.querySelectorAll('.event-row')].find(el => el.innerHTML.includes(id));
  row?.scrollIntoView({behavior:'smooth', block:'center'});
  row?.classList.add('event-row-highlight');
  setTimeout(() => row?.classList.remove('event-row-highlight'), 1600);
}

function escapeEventText(value) {
  const element = document.createElement('span');
  element.textContent = String(value);
  return element.innerHTML;
}

function escapeEventAttribute(value) {
  return escapeEventText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function addEvent(event) {
  event.preventDefault();
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const category = document.getElementById('eventCategory').value;
  if (!title || !date) return;
  if (!(await confirmDataChange(`Add the event “${title}”`))) return;
  events.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title, date, category });
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  addHistory(`Created event: ${title} (${date}, ${category})`);
  renderEvents();
}

async function deleteEvent(id) {
  const item = events.find(event => event.id === id);
  if (!item) return;
  if (!(await confirmDataChange(`Delete the event “${item.title}”`))) return;
  events = events.filter(event => event.id !== id);
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  addHistory(`Deleted event: ${item.title} (${item.date})`);
  renderEvents();
}

function changeDay(dayName) { 
  if (isEditingTimetable) inlineEditSchedules[currentSelectedDay] = inlineEditSchedule;
  currentSelectedDay = dayName; 
  if (isEditingTimetable) inlineEditSchedule = inlineEditSchedules[dayName] || getScheduleForDay(dayName);
  renderUI(); 
}

function renderUI() {
  if (!currentUser) return;
  // Mobile virtual keyboards resize the viewport. Do not rebuild the editor
  // while a timetable field is focused or the browser drops that input focus.
  if (isEditingTimetable && document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
  finalizeMissedClasses();
  const ttSection = document.getElementById('timetableSection');
  const courseSection = document.getElementById('courseList');
  const eventsSection = document.getElementById('eventsSection');
  const wideDashboard = window.matchMedia('(min-width: 900px)').matches && currentTab === 'courses';
  ttSection.style.setProperty('display', (currentTab === 'timetable' || wideDashboard) ? 'block' : 'none', 'important');
  courseSection.style.setProperty('display', currentTab === 'courses' ? 'flex' : 'none', 'important');
  eventsSection.style.setProperty('display', currentTab === 'events' ? 'flex' : 'none', 'important');
  if (currentTab === 'events') renderEvents();
  
  if (currentTab === 'courses') {
      ttSection.style.setProperty('display', wideDashboard ? 'block' : 'none', 'important');
      courseSection.style.setProperty('display', 'flex', 'important');
  } else if (currentTab === 'timetable') {
      ttSection.style.setProperty('display', 'block', 'important');
      courseSection.style.setProperty('display', 'none', 'important');
  } else {
      ttSection.style.setProperty('display', 'none', 'important');
      courseSection.style.setProperty('display', 'none', 'important');
  }

  document.querySelectorAll('.day-selector button').forEach(btn => {
    btn.classList.remove('active-day');
    if (btn.innerText.startsWith(currentSelectedDay.substring(0, 3))) btn.classList.add('active-day');
  });

  const timeContainer = document.getElementById('timetableContainer');
  const editBtn = document.getElementById('editTimetableBtn');
  
  if (isEditingTimetable) {
      editBtn.innerText = '💾';
      timeContainer.className = 'timetable-edit-mode';
      
      let editHtml = '';
      inlineEditSchedule.forEach((p, idx) => {
          editHtml += `
          <div style="background:var(--card-bg); padding:16px; border-radius:12px; display:flex; flex-direction:column; gap:10px; border:1px solid var(--border-color); box-shadow: 0 2px 8px var(--header-shadow);">
              <div style="display:flex; gap:10px; align-items:center;">
                 <button type="button" class="time-picker-btn" onclick="openClockPicker(${idx}, 'start')">🕒 ${format12Hour(p.start) || 'Start'}</button>
                 <span style="font-weight:800; color:var(--text-sub);">to</span>
                 <button type="button" class="time-picker-btn" onclick="openClockPicker(${idx}, 'end')">🕒 ${format12Hour(p.end) || 'End'}</button>
                 <button onclick="removeInlinePeriod(${idx})" style="background:var(--absent-btn); color:white; border:none; border-radius:8px; padding:12px 16px; font-weight:bold; cursor:pointer;">×</button>
              </div>
      <input type="text" class="modal-input" style="margin:0; padding:12px; font-size: 0.95rem; font-weight:700;" value="${escapeEventAttribute(p.name)}" placeholder="Full Course Name" oninput="updateInlinePeriod(${idx}, 'name', this.value)">
          </div>`;
      });
      editHtml += `<button onclick="addInlinePeriod()" style="padding:15px; background:var(--bg-color); color:#3498db; border:2px dashed #3498db; border-radius:12px; cursor:pointer; font-weight:800; font-size:1rem;">+ Add Class to ${currentSelectedDay}</button>`;
      timeContainer.innerHTML = editHtml;

  } else {
      editBtn.innerText = '✏️';
      timeContainer.className = 'timetable-list';

      const isToday = getTodayString() === currentSelectedDay;
      const isSunday = currentSelectedDay === 'Sunday';
      const isDeclaredHoliday = isToday && isTodayHoliday();
      
      const now = new Date(); 
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (isSunday || isDeclaredHoliday) {
        const holidayMsg = isSunday ? 'SUNDAY IS A HOLIDAY' : 'TODAY IS A HOLIDAY';
        timeContainer.innerHTML = `<div class="holiday-banner"><p style="color:var(--absent-btn); font-size:1.15rem; font-weight:800;">🏖️ ${holidayMsg}</p></div>`;
      } else {
        let todaysClasses = [];
        courses.forEach(c => { 
          if (c.schedule && c.schedule[currentSelectedDay]) {
            c.schedule[currentSelectedDay].forEach(slot => { 
              todaysClasses.push({ name: c.name, start: slot.start, end: slot.end, id: c.id }); 
            });
          }
        });
        
        if (todaysClasses.length === 0) {
          timeContainer.innerHTML = `<p style="color:var(--text-sub); text-align:center; padding:25px;">No classes scheduled for ${currentSelectedDay}.</p>`;
        } else {
          todaysClasses.sort((a, b) => a.start.localeCompare(b.start));
          let html = '';

          todaysClasses.forEach(cls => {
            let status = '';
            let indicator = '';
            let inlineActions = '';

            if (isToday) { 
              if (currentTime >= cls.start && currentTime <= cls.end) {
                status = 'active'; 
                indicator = '<span class="live-dot-small"></span>';
              } else if (currentTime > cls.end) {
                status = 'past'; 
              } else {
                status = 'upcoming';
              }
              
              let slotKey = `${getTodayDateString()}_${cls.id}_${cls.start}`;
              let dailyMarks = JSON.parse(localStorage.getItem('daily_marks_v41')) || {};
              let mark = dailyMarks[slotKey];
              let presActive = mark === 'present' ? 'selected' : '';
              let absActive = mark === 'absent' ? 'selected' : '';
              let cancelActive = mark === 'cancelled' ? 'selected' : '';
              
              inlineActions = `
              <div class="timeline-actions">
                 <button class="btn-card-action btn-present-slot ${presActive}" aria-pressed="${mark === 'present'}" onclick="toggleSlotAttendance(${cls.id}, '${cls.start}', 'present')">Present</button>
                 <button class="btn-card-action btn-absent-slot ${absActive}" aria-pressed="${mark === 'absent'}" onclick="toggleSlotAttendance(${cls.id}, '${cls.start}', 'absent')">Absent</button>
                 <button class="btn-card-action btn-cancel-slot ${cancelActive}" aria-pressed="${mark === 'cancelled'}" onclick="toggleSlotAttendance(${cls.id}, '${cls.start}', 'cancelled')">${mark === 'cancelled' ? 'Cancelled · undo' : 'Cancelled'}</button>
              </div>`;
            }

            html += `
              <div class="timeline-card ${status}">
                <div>
                  <div class="timeline-time">${indicator}${format12Hour(cls.start)} - ${format12Hour(cls.end)}</div>
                  <div class="timeline-course">${escapeEventText(cls.name)}</div>
                </div>
                ${inlineActions}
              </div>`;
          });
          timeContainer.innerHTML = html;
        }
      }
  }

  const listContainer = document.getElementById('courseList');
  listContainer.innerHTML = `<div class="report-actions"><div class="report-export-actions"><button class="export-csv-btn" onclick="downloadAttendanceCsv()">📊 Export Excel / CSV</button><button class="export-pdf-btn" onclick="printAdvisorReport()">📄 Print Attendance Report PDF</button></div><button class="simulator-launch" onclick="openWhatIfSimulator()">What-If Simulator</button></div>`;
  if (courses.length === 0) { 
    listContainer.innerHTML = `<section class="empty-courses"><h2>No courses yet</h2><p>Add your courses to start tracking attendance and planning your safe bunk buffer.</p><button class="btn-present" onclick="openModal('addCourse')">Add a course</button></section>`;
    return; 
  }

  const holidayMode = isTodayHoliday() || getTodayString() === 'Sunday';
  const baseStats = getCalculatedAttendance();
  const summary = courses.reduce((totals, course) => {
    totals.present += Math.max(0, (baseStats[course.id]?.p || 0) + (course.present || 0));
    totals.absent += Math.max(0, (baseStats[course.id]?.a || 0) + (course.absent || 0));
    return totals;
  }, { present: 0, absent: 0 });
  const summaryTotal = summary.present + summary.absent;
  const overallPercentage = summaryTotal ? Math.round(summary.present / summaryTotal * 100) : 0;
  listContainer.innerHTML += `<section class="attendance-overview" aria-label="Overall attendance summary"><div><span class="overview-label">Overall attendance</span><strong class="overview-value">${overallPercentage}<span>%</span></strong></div><div class="overview-stat"><span>Classes attended</span><strong>${summary.present}<small> / ${summaryTotal}</small></strong></div><div class="overview-stat"><span>Target</span><strong>${targetPercentage ? `${targetPercentage}%` : 'Not set'}</strong></div></section><h2 class="course-list-title">Course attendance</h2>`;

  courses.forEach(course => {
    const totalPresent = Math.max(0, (baseStats[course.id]?.p || 0) + (course.present || 0));
    const totalAbsent = Math.max(0, (baseStats[course.id]?.a || 0) + (course.absent || 0));
    const total = totalPresent + totalAbsent;
    
    const percentage = total === 0 ? 0 : Math.round((totalPresent / total) * 100);
    const dashOffset = (2 * Math.PI * 34) - ((percentage / 100) * (2 * Math.PI * 34));
    let actionHTML = holidayMode 
      ? `<div class="action-bar" id="action-${course.id}"><span style="font-weight: 800; color: var(--absent-btn);">HOLIDAY</span></div>` 
      : `<div class="action-bar" id="action-${course.id}"><button class="btn-present" onclick="markAttendance(${course.id}, 'present')">PRESENT</button><button class="btn-absent" onclick="markAttendance(${course.id}, 'absent')">ABSENT</button></div>`;

    listContainer.innerHTML += `
      <div class="course-card-wrapper">
        <div class="course-card" role="button" tabindex="0" aria-label="${escapeEventAttribute(course.name)}: ${percentage}% attendance. Show marking actions" onclick="toggleActionBar(${course.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleActionBar(${course.id})}">
          <div class="progress-circle">
            <svg width="80" height="80">
              <circle cx="40" cy="40" r="34" stroke="var(--absent-btn)" stroke-width="7" fill="transparent" />
              <circle cx="40" cy="40" r="34" stroke="var(--present-btn)" stroke-width="7" fill="transparent" stroke-dasharray="213.6" stroke-dashoffset="${dashOffset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease-in-out;" />
            </svg>
            <div class="percentage-text" style="color:var(--text-main); font-size:1.15rem;">${percentage}%</div>
          </div>
          <div class="course-info">
            <h2>${escapeEventText(course.name)}</h2>
            <p>Total Classes: ${total}</p>
            ${getBunkStatus(totalPresent, totalAbsent)}
          </div>
        </div>
        ${actionHTML}
      </div>`;
  });
}

function openWhatIfSimulator() {
  const options = courses.map(c => `<option value="${c.id}">${escapeEventText(c.name)}</option>`).join('');
  const content = document.getElementById('modalContent');
  content.className = 'modal-content whatif-modal';
  content.innerHTML = `<button class="close-btn" onclick="forceCloseModal()" aria-label="Close simulator">×</button><h2>What-If Attendance Simulator</h2>${courses.length ? `<label>Course<select id="whatIfCourse" onchange="updateWhatIfProjection()">${options}</select></label><label>Future classes to attend: <output id="whatIfAttendValue">0</output><input id="whatIfAttend" type="range" min="0" max="100" value="0" oninput="updateWhatIfProjection()"></label><label>Future classes to miss: <output id="whatIfMissValue">0</output><input id="whatIfMiss" type="range" min="0" max="100" value="0" oninput="updateWhatIfProjection()"></label><button class="vpopup-btn vpopup-btn-cancel" onclick="resetWhatIfProjection()">Reset</button><div id="whatIfResult" aria-live="polite"></div>` : '<p>Add a course first to simulate attendance.</p>'}`;
  document.getElementById('modalOverlay').classList.add('active');
  document.body.classList.add('scroll-locked');
  if (courses.length) updateWhatIfProjection();
}

function updateWhatIfProjection() {
  const id = document.getElementById('whatIfCourse')?.value;
  const course = courses.find(c => String(c.id) === id);
  if (!course) return;
  const attend = Number(document.getElementById('whatIfAttend').value);
  const miss = Number(document.getElementById('whatIfMiss').value);
  document.getElementById('whatIfAttendValue').value = attend;
  document.getElementById('whatIfMissValue').value = miss;
  const stats = getCalculatedAttendance()[course.id] || {p:0,a:0};
  const present = Math.max(0, stats.p + (course.present || 0));
  const absent = Math.max(0, stats.a + (course.absent || 0));
  const total = present + absent;
  const projectedTotal = total + attend + miss;
  const projected = projectedTotal ? (present + attend) / projectedTotal * 100 : 0;
  let feedback = 'Set a target attendance percentage to see safety and recovery guidance.';
  if (targetPercentage) {
    if (projected >= targetPercentage) {
      const buffer = Math.max(0, Math.floor(((present + attend) / (targetPercentage / 100)) - projectedTotal + 1e-8));
      feedback = `<strong>Safe</strong> · Bunk buffer: ${buffer} class${buffer === 1 ? '' : 'es'}.`;
    } else {
      const needed = Math.ceil(((targetPercentage / 100 * projectedTotal) - (present + attend)) / (1 - targetPercentage / 100));
      feedback = `<strong>Shortage</strong> · Attend the next ${needed} consecutive class${needed === 1 ? '' : 'es'} to recover.`;
    }
  }
  document.getElementById('whatIfResult').innerHTML = `Baseline: ${present} present, ${absent} absent (${total} total).<br>Projected attendance: <strong>${projected.toFixed(1)}%</strong><br>${feedback}`;
}

function resetWhatIfProjection() {
  document.getElementById('whatIfAttend').value = 0;
  document.getElementById('whatIfMiss').value = 0;
  updateWhatIfProjection();
}

function attendanceReportRows() {
  const stats = getCalculatedAttendance();
  return courses.map(course => {
    const present = Math.max(0, (stats[course.id]?.p || 0) + (course.present || 0));
    const absent = Math.max(0, (stats[course.id]?.a || 0) + (course.absent || 0));
    const total = present + absent;
    const percentage = total ? Math.round(present / total * 100) : 0;
    const eligible = targetPercentage ? percentage >= targetPercentage : null;
    return { code: course.code || '—', name: course.name, present, absent, total, percentage, status: eligible === null ? 'Target not set' : eligible ? 'Eligible' : 'Below target' };
  });
}

function downloadAttendanceCsv() {
  const rows = attendanceReportRows();
  const csvCell = value => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [['Course Code','Course Name','Present','Absent','Total Classes','Attendance %','Status'], ...rows.map(r=>[r.code,r.name,r.present,r.absent,r.total,`${r.percentage}%`,r.status])];
  const blob = new Blob([`\uFEFF${lines.map(row=>row.map(csvCell).join(',')).join('\r\n')}`], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download='attendance-report.csv'; link.click(); URL.revokeObjectURL(url);
}

function printAdvisorReport() {
  const rows = attendanceReportRows();
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) return alert('Allow pop-ups to print the advisor report.');
  reportWindow.document.write(`<!doctype html><html><head><title>Attendance Advisor Report</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#172033}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #555;padding:9px;text-align:left}th{background:#edf2f7}.signatures{display:flex;gap:70px;margin-top:90px}.signatures div{flex:1;border-top:1px solid #222;padding-top:8px;text-align:center}.meta{margin-top:22px}</style></head><body><h1>Attendance Report</h1><p class="meta">Student: ____________________ &nbsp; Term: ____________________ &nbsp; Target: ${targetPercentage ? `${targetPercentage}%` : 'Not set'}</p><table><thead><tr><th>Course Code</th><th>Course</th><th>Present</th><th>Absent</th><th>Total</th><th>Attendance</th><th>Eligibility</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeEventText(r.code)}</td><td>${escapeEventText(r.name)}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.total}</td><td>${r.percentage}%</td><td>${r.status}</td></tr>`).join('')}</tbody></table><div class="signatures"><div>Student Signature</div><div>Mentor / Advisor Signature</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
  reportWindow.document.close();
}

function markAttendance(id, status) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  if (status === 'present') course.present = (course.present || 0) + 1;
  if (status === 'absent') course.absent = (course.absent || 0) + 1;
  addHistory(`Manual ${status.toUpperCase()}: ${course.name}`);
  toggleActionBar(id); 
  saveToDatabase(); 
  renderUI();    
}

function toggleActionBar(id) {
  const bar = document.getElementById(`action-${id}`);
  document.querySelectorAll('.action-bar').forEach(el => { 
    if (el.id !== `action-${id}`) el.classList.remove('slide-in'); 
  });
  bar.classList.toggle('slide-in');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.course-card-wrapper')) {
    document.querySelectorAll('.action-bar').forEach(bar => bar.classList.remove('slide-in'));
  }
});

// ==========================================
// 10. MODALS, SIDEBAR CONTROLLER & AUTH
// ==========================================
function toggleMenu() { 
  if (!requireSignedIn()) return;
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('menuOverlay');
  
  if (!sidebar || !overlay) return;
  
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    
    const settingsShowing = document.getElementById('settingsOverlay')?.classList.contains('active');
    const modalShowing = document.getElementById('modalOverlay')?.classList.contains('active');
    if (!settingsShowing && !modalShowing) {
      document.body.classList.remove('scroll-locked');
    }
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.classList.add('scroll-locked');
  }
}

function toggleSettings(forceOpen) {
  if (!requireSignedIn()) return;
  const overlay = document.getElementById('settingsOverlay');
  const gear = document.getElementById('settingsGear');
  const open = typeof forceOpen === 'boolean' ? forceOpen : !overlay.classList.contains('active');
  overlay.classList.toggle('active', open);
  overlay.setAttribute('aria-hidden', String(!open));
  gear.classList.toggle('rotated', open);
  if (open) { document.body.classList.add('scroll-locked'); openSettingsTab('account'); }
  else { document.body.classList.remove('scroll-locked'); document.getElementById('settingsPanel').innerHTML = ''; }
}

function closeSettingsThen(callback) {
  const overlay = document.getElementById('settingsOverlay');
  const screen = overlay?.querySelector('.settings-screen');
  if (!overlay?.classList.contains('active') || !screen) return callback();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let finished = false;
  let fallbackTimer;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    screen.removeEventListener('transitionend', onTransitionEnd);
    callback();
  };
  const onTransitionEnd = event => {
    if (event.target === screen && event.propertyName === 'transform') finish();
  };

  screen.addEventListener('transitionend', onTransitionEnd);
  toggleSettings(false);
  document.body.classList.add('scroll-locked');
  fallbackTimer = setTimeout(finish, reducedMotion ? 40 : 480);
}

function openSettingsTab(tab) {
  const tabs = [...document.querySelectorAll('#settingsTabs [role="tab"]')];
  const activeTab = tabs.find(button => button.dataset.settingsTab === tab);
  if (!activeTab) return;
  tabs.forEach(button => {
    const selected = button === activeTab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const panel = document.getElementById('settingsPanel');
  panel.setAttribute('aria-labelledby', activeTab.id);
  if (tab === 'calendar') {
    closeSettingsThen(() => openModal('setupCalendar'));
    return;
  }
  const actionMap = {account:'authModal',help:'userManual',calendar:'setupCalendar',target:'setTarget',edit:'editAttendance',add:'addCourse',remove:'removeCourse'};
  if (tab === 'semesters') {
    const archive = JSON.parse(localStorage.getItem(SEMESTERS_KEY) || '{}');
    const standardSemesters = Array.from({ length: 8 }, (_, index) => `Sem ${index + 1}`);
    const choices = [...new Set([...standardSemesters, ...Object.keys(archive), currentSemester])];
    panel.innerHTML = `
      <section class="settings-tool-section">
        <h3>Semester Archive</h3>
        <p>Keep courses, attendance, target, and calendar data organized by semester.</p>
        <div class="settings-tool-block">
          <label for="semesterChoice">Choose a semester</label>
          <div class="settings-tool-controls settings-semester-controls">
            <select id="semesterChoice">${choices.map(name => `<option value="${escapeEventAttribute(name)}" ${name === currentSemester ? 'selected' : ''}>${escapeEventText(name)}</option>`).join('')}</select>
            <button type="button" class="btn-present" onclick="loadSemester(document.getElementById('semesterChoice').value)">Open Semester</button>
          </div>
          <p class="settings-tool-note">Switching saves the current semester before opening the selected one.</p>
        </div>
      </section>`;
    return;
  }
  if (tab === 'sharing') {
    panel.innerHTML = `
      <section class="settings-tool-section">
        <h3>Timetable Sharing</h3>
        <p>Share your class schedule with a classmate using a short code.</p>
        <div class="settings-tool-block">
          <h4>Create a share code</h4>
          <p>Generate a code for the course schedules saved in this semester.</p>
          <button type="button" class="btn-present" onclick="createTimetableShare()">Create Share Code</button>
          <output id="timetableShareCode" class="share-code-output" aria-live="polite"></output>
        </div>
        <div class="settings-tool-block">
          <h4>Import a timetable</h4>
          <p>Enter a classmate’s code, then choose how it should be applied.</p>
          <label for="timetableImportCode">Timetable share code</label>
          <input id="timetableImportCode" class="modal-input" type="text" placeholder="TT-4821" autocomplete="off" spellcheck="false">
          <div class="settings-tool-controls settings-share-actions">
            <button type="button" class="btn-present" onclick="importTimetable('merge')">Merge with timetable</button>
            <button type="button" class="btn-absent" onclick="importTimetable('replace')">Replace timetable</button>
          </div>
          <p class="settings-tool-note">Merge combines matching course schedules and adds new courses. Replace uses the imported course list and resets its attendance counts.</p>
        </div>
      </section>`;
    return;
  }
  if (tab === 'events') {
    panel.innerHTML = '<h3>Events</h3><p>Open the Events tab to add and manage exams, assignments, fests, holidays, and personal events.</p><button class="btn-present" onclick="toggleSettings(false);switchTab(\'events\')">Open Events</button>';
    return;
  }
  if (tab === 'reset') { panel.innerHTML = '<h3>Reset Timetable</h3><p>Restore your saved default timetable and clear attendance logs.</p><button class="btn-absent" onclick="toggleSettings(false);resetToDefaultTimetable()">Reset Default Timetable</button>'; return; }
  const modalType = actionMap[tab];
  openModal(modalType);
  const modalContent = document.getElementById('modalContent');
  // Modal templates include their own floating close button. The Settings
  // screen has a dedicated header close control, so discard the copied one.
  panel.innerHTML = modalContent.innerHTML.replace(/<button class="close-btn"[^>]*>×<\/button>/, '');
  modalContent.innerHTML = '';
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.classList.add('scroll-locked');
}

document.getElementById('settingsTabs')?.addEventListener('keydown', event => {
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
  const currentIndex = tabs.indexOf(document.activeElement);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  else return;
  event.preventDefault();
  tabs[nextIndex].focus();
  openSettingsTab(tabs[nextIndex].dataset.settingsTab);
});

const SETTINGS_TAB_ICONS = {
  account: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.1 1.7c-1 .9-1.8 1.3-1.8 2.8M12 17h.01"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M4 9h16M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  edit: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  add: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  remove: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2.3 5.7M4 5v6h6"/>',
  events: '<path d="M5 4h14v17H5zM8 2v4M16 2v4M5 9h14M8 13h2M14 13h2M8 17h2"/>',
  semesters: '<path d="M4 5.5c3-1.5 5.7-1.2 8 1v14c-2.3-2.2-5-2.5-8-1zM20 5.5c-3-1.5-5.7-1.2-8 1v14c2.3-2.2 5-2.5 8-1z"/>',
  sharing: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.6M8.3 13.2l7.4 4.6"/>'
};
document.querySelectorAll('#settingsTabs [role="tab"]').forEach(button => {
  const icon = SETTINGS_TAB_ICONS[button.dataset.settingsTab];
  if (icon) button.insertAdjacentHTML('afterbegin', `<svg class="settings-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`);
});
const settingsTabList = document.getElementById('settingsTabs');
const syncSettingsTabOrientation = () => settingsTabList?.setAttribute('aria-orientation', matchMedia('(max-width: 600px)').matches ? 'horizontal' : 'vertical');
syncSettingsTabOrientation();
window.addEventListener('resize', syncSettingsTabOrientation, { passive: true });

function switchAuthMode(mode) {
  authMode = mode;
  openModal('authModal');
}

let setupBlobUrl = null;
let setupTempData = {};
let setupStartDate = null;
let setupEndDate = null;
let setupZoomScale = 1;
let setupZoomX = 0;
let setupZoomY = 0;
let setupZoomPointers = new Map();
let setupZoomGesture = null;

function clampSetupZoomPan() {
  const wrapper = document.getElementById('previewWrapper');
  const image = wrapper?.querySelector('.setup-preview-image');
  if (!wrapper || !image || setupZoomScale <= 1) {
    setupZoomX = 0;
    setupZoomY = 0;
    return;
  }
  const bounds = wrapper.getBoundingClientRect();
  const aspect = image.naturalWidth / image.naturalHeight || 1;
  const fitWidth = Math.min(bounds.width, bounds.height * aspect);
  const fitHeight = Math.min(bounds.height, bounds.width / aspect);
  setupZoomX = Math.max(-fitWidth * (setupZoomScale - 1) / 2, Math.min(fitWidth * (setupZoomScale - 1) / 2, setupZoomX));
  setupZoomY = Math.max(-fitHeight * (setupZoomScale - 1) / 2, Math.min(fitHeight * (setupZoomScale - 1) / 2, setupZoomY));
}

function updateSetupImageZoom() {
  const wrapper = document.getElementById('previewWrapper');
  const image = wrapper?.querySelector('.setup-preview-image');
  if (!wrapper || !image) return;
  clampSetupZoomPan();
  image.style.transform = `translate3d(${setupZoomX}px, ${setupZoomY}px, 0) scale(${setupZoomScale})`;
  image.style.cursor = setupZoomScale > 1 ? (setupZoomGesture?.kind === 'pan' ? 'grabbing' : 'grab') : 'default';
  const indicator = wrapper.querySelector('.preview-zoom-level');
  if (indicator) indicator.textContent = `${Math.round(setupZoomScale * 100)}%`;
}

function setSetupImageZoom(nextScale) {
  setupZoomScale = Math.max(1, Math.min(5, nextScale));
  if (setupZoomScale === 1) {
    setupZoomX = 0;
    setupZoomY = 0;
  }
  updateSetupImageZoom();
}

function adjustSetupImageZoom(direction) {
  setSetupImageZoom(setupZoomScale * (direction === 'in' ? 1.25 : 0.8));
}

function resetSetupImageZoom() {
  setupZoomPointers.clear();
  setupZoomGesture = null;
  setupZoomScale = 1;
  setupZoomX = 0;
  setupZoomY = 0;
  updateSetupImageZoom();
}

function attachSetupImageZoom(wrapper) {
  const image = wrapper.querySelector('.setup-preview-image');
  if (!image) return;
  wrapper.classList.add('zoomable-image-preview');
  resetSetupImageZoom();

  wrapper.addEventListener('pointerdown', event => {
    if (event.target.closest('.preview-zoom-controls')) return;
    setupZoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    wrapper.setPointerCapture(event.pointerId);
    if (setupZoomPointers.size === 1) {
      setupZoomGesture = { kind: 'pan', x: event.clientX, y: event.clientY, panX: setupZoomX, panY: setupZoomY };
    } else if (setupZoomPointers.size === 2) {
      const [a, b] = [...setupZoomPointers.values()];
      setupZoomGesture = {
        kind: 'pinch',
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: setupZoomScale
      };
    }
    updateSetupImageZoom();
  });

  wrapper.addEventListener('pointermove', event => {
    if (!setupZoomPointers.has(event.pointerId)) return;
    setupZoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (setupZoomPointers.size >= 2 && setupZoomGesture?.kind === 'pinch') {
      const [a, b] = [...setupZoomPointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (setupZoomGesture.distance > 0) {
        setupZoomScale = Math.max(1, Math.min(5, setupZoomGesture.scale * distance / setupZoomGesture.distance));
      }
    } else if (setupZoomGesture?.kind === 'pan' && setupZoomScale > 1) {
      setupZoomX = setupZoomGesture.panX + event.clientX - setupZoomGesture.x;
      setupZoomY = setupZoomGesture.panY + event.clientY - setupZoomGesture.y;
    }
    updateSetupImageZoom();
  });

  const finishPointer = event => {
    setupZoomPointers.delete(event.pointerId);
    if (setupZoomPointers.size === 1) {
      const [pointer] = setupZoomPointers.values();
      setupZoomGesture = { kind: 'pan', x: pointer.x, y: pointer.y, panX: setupZoomX, panY: setupZoomY };
    } else {
      setupZoomGesture = null;
    }
    updateSetupImageZoom();
  };
  wrapper.addEventListener('pointerup', finishPointer);
  wrapper.addEventListener('pointercancel', finishPointer);
  wrapper.addEventListener('wheel', event => {
    event.preventDefault();
    setSetupImageZoom(setupZoomScale * (event.deltaY < 0 ? 1.12 : 0.89));
  }, { passive: false });
}

async function startCalendarSetup() {
  const fileInput = document.getElementById('calFileInput');
  setupStartDate = document.getElementById('termStart').value;
  setupEndDate = document.getElementById('termEnd').value;

  if (!setupStartDate || !setupEndDate) {
    return alert("Please select both semester start and end dates.");
  }
  if (new Date(setupStartDate) > new Date(setupEndDate)) {
    return alert("Start date cannot be after the end date.");
  }

  if (!fileInput.files.length) {
    if (!(await confirmDataChange('Save the semester start and end dates', true))) return;
    if (document.getElementById('settingsOverlay')?.classList.contains('active')) toggleSettings(false);
    academicCalendar = {
      ...(academicCalendar || {}),
      startDate: setupStartDate,
      endDate: setupEndDate,
      holidays: academicCalendar?.holidays || [],
      importantDates: academicCalendar?.importantDates || []
    };
    localStorage.setItem(CALENDAR_KEY, JSON.stringify(academicCalendar));
    saveToDatabase();
    forceCloseModal();
    renderUI();
    openModal('calendarMode');
    return;
  }

  const file = fileInput.files[0];
  setupBlobUrl = URL.createObjectURL(file);
  const previewWrapper = document.getElementById('previewWrapper');
  const isImage = file.type.match(/image/i) || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i);
  
  if (isImage) {
    previewWrapper.innerHTML = `<img id="setupImagePreview" class="setup-preview-image" src="${setupBlobUrl}" alt="Calendar preview" /><div class="preview-zoom-controls" aria-label="Image zoom controls"><button type="button" onclick="adjustSetupImageZoom('out')" aria-label="Zoom out" title="Zoom out">−</button><span class="preview-zoom-level" aria-live="polite">100%</span><button type="button" onclick="adjustSetupImageZoom('in')" aria-label="Zoom in" title="Zoom in">+</button><button type="button" onclick="resetSetupImageZoom()" aria-label="Reset zoom" title="Reset zoom">Reset</button></div>`;
    attachSetupImageZoom(previewWrapper);
  } else {
    previewWrapper.classList.remove('zoomable-image-preview');
    previewWrapper.innerHTML = `<iframe src="${setupBlobUrl}" title="Calendar PDF preview" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; background:white;"></iframe>`;
  }
  
  setupTempData = {}; 
  if (academicCalendar) {
    if (academicCalendar.holidays) academicCalendar.holidays.forEach(d => setupTempData[d] = 'holiday');
    if (academicCalendar.importantDates) academicCalendar.importantDates.forEach(d => setupTempData[d] = 'important');
  }

  buildSetupCalendar(setupStartDate, setupEndDate);
  if (document.getElementById('settingsOverlay')?.classList.contains('active')) toggleSettings(false);
  forceCloseModal();
  document.getElementById('splitScreenOverlay').classList.add('active');
  document.body.classList.add('scroll-locked');
}

function buildSetupCalendar(startStr, endStr) {
  const container = document.getElementById('setupCalendarContainer');
  let html = '';
  let startDate = new Date(startStr + 'T00:00:00');
  let endDate = new Date(endStr + 'T00:00:00');
  let startYear = startDate.getFullYear();
  let endYear = Math.max(endDate.getFullYear(), startYear + 1);
  let curr = new Date(startYear, 0, 1); 
  let finalDate = new Date(endYear, 11, 31); 
  
  while (curr <= finalDate) {
    const year = curr.getFullYear();
    const month = curr.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    
    html += `<div class="setup-month"><div class="setup-month-title">${monthNames[month]} ${year}</div><div class="cal-weekdays"><span>Su</span><span>M</span><span>Tu</span><span>W</span><span>Th</span><span>F</span><span>Sa</span></div><div class="cal-grid-month">`;
    for (let i = 0; i < firstDay; i++) { html += `<div class="cal-day empty"></div>`; }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const iterDate = new Date(year, month, i);
      const isSunday = iterDate.getDay() === 0 ? 'sunday' : '';
      
      let preStatus = '';
      if (setupTempData[dateStr] === 'holiday') preStatus = 'holiday';
      if (setupTempData[dateStr] === 'important') preStatus = 'important';

      html += `<div class="cal-day ${isSunday} ${preStatus}" id="setup-${dateStr}" onclick="cyclePaintMode('${dateStr}', this)"><span>${i}</span></div>`;
    }
    html += `</div></div>`;
    curr.setMonth(curr.getMonth() + 1); 
  }
  container.innerHTML = html;
}

function cyclePaintMode(dateStr, element) {
  if (element.classList.contains('holiday')) {
    element.classList.remove('holiday');
    element.classList.add('important');
    setupTempData[dateStr] = 'important';
  } else if (element.classList.contains('important')) {
    element.classList.remove('important');
    delete setupTempData[dateStr];
  } else {
    element.classList.add('holiday');
    setupTempData[dateStr] = 'holiday';
  }
}

async function saveSetupCalendar() {
  if (!(await confirmDataChange('Save the semester dates and calendar markings', true))) return;
  let holidays = [];
  let importantDates = [];
  for (const [date, type] of Object.entries(setupTempData)) {
    if (type === 'holiday') holidays.push(date);
    if (type === 'important') importantDates.push(date);
  }
  academicCalendar = { startDate: setupStartDate, endDate: setupEndDate, holidays: holidays, importantDates: importantDates };
  localStorage.setItem(CALENDAR_KEY, JSON.stringify(academicCalendar));
  saveToDatabase();
  alert("Calendar Saved Successfully!");
  closeSplitScreen();
  renderUI(); 
}

function closeSplitScreen() {
  document.getElementById('splitScreenOverlay').classList.remove('active');
  const previewWrapper = document.getElementById('previewWrapper');
  if (previewWrapper) previewWrapper.innerHTML = '';
  if (setupBlobUrl) {
    URL.revokeObjectURL(setupBlobUrl);
    setupBlobUrl = null;
  }
  if (!document.getElementById('settingsOverlay')?.classList.contains('active') && !document.getElementById('modalOverlay')?.classList.contains('active')) {
    document.body.classList.remove('scroll-locked');
  }
}

function changeCalendarMonth(dir) {
  currentCalDate.setDate(1); 
  currentCalDate.setMonth(currentCalDate.getMonth() + dir);
  openModal('calendarMode');
}

async function toggleFullDayPresent(dateString) {
  if (!academicCalendar || !academicCalendar.startDate) {
    alert("Please sync your Academic Calendar first to set the term start date."); return;
  }
  if (dateString < academicCalendar.startDate) {
    alert("You cannot mark attendance for days before the term started."); return;
  }
  const todayStr = getTodayDateString();
  if (dateString > todayStr) {
    alert("You cannot mark attendance for future dates."); return;
  }

  const isAlreadyMarked = markedDates.includes(dateString);
  if (isAlreadyMarked) {
    markedDates = markedDates.filter(d => d !== dateString);
    addHistory(`Unmarked Day: ${dateString}`);
  } else {
    markedDates.push(dateString);
    addHistory(`Marked Day Present: ${dateString}`);
    let dailyMarks = JSON.parse(localStorage.getItem('daily_marks_v41')) || {};
    const [y, m, d] = dateString.split('-');
    const localDate = new Date(y, m-1, d);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[localDate.getDay()];

    courses.forEach(c => {
       if (c.schedule && c.schedule[dayName]) {
          c.schedule[dayName].forEach(slot => {
             delete dailyMarks[`${dateString}_${c.id}_${slot.start}`]; 
          });
       }
    });
    localStorage.setItem('daily_marks_v41', JSON.stringify(dailyMarks));
  }
  
  saveToDatabase(); 
  openModal('calendarMode'); 
  renderUI(); 
}

function openModal(type) {
  if (!currentUser && type !== 'authModal') {
    requireSignedIn();
    return;
  }
  if (document.getElementById('settingsOverlay')?.classList.contains('active')) {
    const panel = document.getElementById('settingsPanel');
    panel.innerHTML = '';
  }
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('menuOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');

  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalOverlay.classList.add('active');
  document.body.classList.add('scroll-locked');
  
  if (type === 'authModal') {
    modalContent.className = 'modal-content auth-modal-card';
  } else {
    modalContent.className = 'modal-content';
  }

  let html = currentUser ? `<button class="close-btn" onclick="forceCloseModal()">×</button>` : '';

  if (type === 'authModal') {
    if (currentUser) {
      html += `
        <h2>${userRole === 'admin' ? 'Administrator Account' : 'Student Account'}</h2>
        <div style="text-align:center; padding:15px 0;">
          <p style="font-size:1.15rem; font-weight:700; color:var(--text-main);">${currentUser.displayName || 'Student'}</p>
          <p style="font-size:0.9rem; color:var(--text-sub); margin-bottom:15px;">${currentUser.email}</p>
          <div style="display:inline-block; padding:6px 14px; border-radius:20px; font-size:0.8rem; font-weight:700; background:${userRole === 'admin' ? 'var(--absent-btn)' : '#3498db'}; color:white; margin-bottom:15px;">
            ${userRole === 'admin' ? '🛡️ Administrator' : 'Student Account'}
          </div>
          <p style="font-size:0.85rem; color:var(--text-sub); margin-bottom:15px;">Your attendance data is synced with Cloud Firestore.</p>
          
          <button class="vpopup-btn vpopup-btn-cancel" style="width:100%; margin-top:5px;" onclick="logoutUser()">Sign Out</button>
        </div>
      `;
    } else if (!auth) {
      html += `
        <div class="auth-brand-badge">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h2>Sign-in unavailable</h2>
        <div class="auth-unavailable" role="alert">
          <strong>Firebase isn’t connected for this deployment.</strong>
          Sign-in can’t start until the site is deployed with its Firebase runtime configuration. Please try again after the app administrator fixes the deployment.
        </div>
      `;
    } else {
      const isRegister = (authMode === 'register');
      const title = isRegister ? 'Create an Account' : 'Welcome Back';
      const subtitle = isRegister 
        ? 'Get started with attendance tracking and cloud backup' 
        : 'Sign in to access your attendance records and schedule';
      const actionText = isRegister ? 'Sign Up' : 'Sign In';

      html += `
        <div class="auth-brand-badge">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h2>${title}</h2>
        <p class="auth-subtext">${subtitle}</p>

        <button class="btn-google-oauth" onclick="loginWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.8.54-1.83.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A8.99 8.99 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.71V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .96 4.96l3.01 2.33c.71-2.13 2.69-3.71 5.03-3.71z"/>
          </svg>
          Continue with Google
        </button>

        <div class="auth-divider">
          <span>or continue with email</span>
        </div>

        <div class="auth-input-group">
          <label>Email address</label>
          <input type="email" id="authEmail" class="modal-input" placeholder="name@college.edu" autocomplete="email" />
        </div>

        <div class="auth-input-group">
          <label>Password</label>
          <input type="password" id="authPassword" class="modal-input" placeholder="Enter your password" autocomplete="current-password" />
        </div>

        <button class="btn-auth-primary" onclick="${isRegister ? "registerWithEmail(document.getElementById('authEmail').value, document.getElementById('authPassword').value)" : "loginWithEmail()"}">
          ${actionText}
        </button>

        <div class="auth-switch-prompt">
          ${isRegister 
            ? `Already have an account? <a onclick="switchAuthMode('signin')">Sign In</a>` 
            : `Don't have an account? <a onclick="switchAuthMode('register')">Sign Up</a>`}
        </div>
      `;
    }
  } else if (type === 'userManual') {
    html += `
      <h2>How to Use Attendance Tracker</h2>
      <p class="guide-intro">Quick, visual walkthroughs for the main tools. Open a section to see what to tap and what happens next.</p>
      <div class="feature-guide">
        <details open><summary>📚 Courses and attendance</summary><p>Each course shows your attendance percentage, total classes, and target status. Tap a course card to open its attendance actions.</p><div class="guide-demo" aria-label="Example attendance buttons"><span class="guide-demo-label">COURSE ACTIONS</span><div class="guide-demo-row"><span class="guide-demo-course">🧪 Chemistry</span><button type="button" class="guide-demo-button demo-present" tabindex="-1">✓ Present</button><button type="button" class="guide-demo-button demo-absent" tabindex="-1">✕ Absent</button></div></div><p>Use <b>What‑If Simulator</b> to preview future classes without changing saved attendance. Download <b>Export Excel / CSV</b> or open <b>Print Attendance Report PDF</b> for a printable report.</p></details>
        <details><summary>🗓️ Timetable and marking a class</summary><p>Choose a day to view that day’s classes. Use <b>Present</b>, <b>Absent</b>, or <b>Cancelled</b> on a class. If a class passes without a mark, it is automatically recorded absent when its end time passes.</p><div class="guide-demo" aria-label="Example timetable class"><span class="guide-demo-label">TODAY · 10:00 AM</span><div class="guide-demo-row"><span class="guide-demo-course">⚛️ Physics</span><button type="button" class="guide-demo-button demo-present" tabindex="-1">✓ Present</button><button type="button" class="guide-demo-button demo-absent" tabindex="-1">✕ Absent</button></div></div><p>Tap ✏️ to edit the timetable across days. Set start and end times, add or remove class rows, then save. The follow-up asks whether to make the saved schedule your default.</p></details>
        <details><summary>🎯 Target and attendance editing</summary><p>In Settings, <b>Target Attendance</b> sets your goal percentage. Course cards then show how many classes you can safely miss or how many consecutive classes you need to attend to recover. <b>Edit Attendance</b> adjusts a course’s saved present and total counts; review the confirmation before saving.</p><div class="guide-demo" aria-label="Example settings controls"><span class="guide-demo-label">SETTINGS</span><div class="guide-demo-row"><span class="guide-demo-course">🎯 Target</span><span class="guide-demo-value">75%</span><button type="button" class="guide-demo-button demo-present" tabindex="-1">Save Target</button></div></div></details>
        <details><summary>📅 Semester calendar</summary><p>Open Settings → <b>Academic Calendar</b> and enter the semester start and end dates. Attendance dates before the semester begins and future dates are blocked. Adding an image or PDF is optional. Open the calendar from the header clock; tap an eligible date to mark or unmark the whole day present.</p></details>
        <details><summary>🎟️ Events</summary><p>Open the <b>Events</b> bottom tab. Add a title, date, and category (Exam, Assignment, Fest, Holiday, Personal, or Club). Use the filters to view all, upcoming, or past events; filter by category and sort by date. Events stay on this device. The banner starts with today’s event, or the nearest upcoming event if there is none today. Swipe left for upcoming events and right for past events; the nearest past event appears first. Dates with events are flagged on the calendar.</p><div class="guide-demo" aria-label="Example event controls"><span class="guide-demo-label">EVENTS</span><div class="guide-demo-row"><span class="guide-demo-course">🎟️ Add an event</span><span class="guide-demo-value">Title · Date · Category</span><button type="button" class="guide-demo-button demo-present" tabindex="-1">＋ Add</button></div></div></details>
        <details><summary>🛠️ Settings and semesters</summary><p>The gear opens Settings. Use its sections to manage account, this guide, calendar dates, target, attendance, courses, timetable reset, events, timetable sharing, and semester archives. Reset restores the default timetable and clears attendance history for the active semester. <b>Semesters</b> keeps data separate across Sem 1 through Sem 8; confirm before switching.</p></details>
        <details><summary>🔗 Share a timetable</summary><p>In Settings → <b>Share Timetable</b>, create a code and share it with a classmate. They can enter the code and choose <b>Merge</b> to combine schedules or <b>Replace</b> to use the shared schedule instead. Sharing and importing require the cloud connection and ask for confirmation before changes.</p></details>
        <details><summary>🌗 Theme and account sync</summary><p>Use the light/dark switch in Settings to change the display. Sign in from <b>Account</b> to sync attendance data to Cloud Firestore. Event lists are device-local and are not shared across devices. A data disclaimer appears before saved changes; choose Cancel to leave the saved data as it was.</p></details>
      </div>`;
  } else if (type === 'historyLog') {
    html += `<h2>History Log</h2><div class="history-list">`;
    if (historyLog.length === 0) html += `<p style="color:var(--text-sub);">No history yet.</p>`;
    historyLog.forEach(log => { 
      html += `<div class="history-item"><span>${log.action}</span><span style="color:var(--text-sub); font-size:0.75rem;">${log.time}</span></div>`; 
    });
    html += `</div>`;
  } else if (type === 'setupCalendar') {
    html += `
      <h2>Set Semester Dates</h2>
      <div style="text-align:left; margin-top:15px;">
        <label style="font-size:0.85rem; color:var(--text-sub);">Optional calendar reference (image or PDF)</label>
        <input type="file" id="calFileInput" accept="image/*, application/pdf" class="modal-input" />
        <label style="font-size:0.85rem; color:var(--text-sub);">Semester Start Date</label>
        <input type="date" id="termStart" class="modal-input" value="${academicCalendar?.startDate || ''}" required />
        <label style="font-size:0.85rem; color:var(--text-sub);">Semester End Date</label>
        <input type="date" id="termEnd" class="modal-input" value="${academicCalendar?.endDate || ''}" required />
        <button class="btn-present" style="width:100%; padding:12px;" onclick="startCalendarSetup()">${academicCalendar?.startDate ? 'Save Semester Dates' : 'Continue'}</button>
      </div>`;
  } else if (type === 'calendarMode') {
    if (!academicCalendar) {
      html += `<h2>Calendar</h2><p style="color:var(--text-sub); margin-top:15px;">Sync the calendar from the menu first.</p>`;
    } else {
      const year = currentCalDate.getFullYear();
      const month = currentCalDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
      const todayStr = getTodayDateString();

      html += `
        <div class="month-header">
          <button class="month-nav" onclick="changeCalendarMonth(-1)">&#10094;</button>
          <h2>${monthNames[month]} ${year}</h2>
          <button class="month-nav" onclick="changeCalendarMonth(1)">&#10095;</button>
        </div>
        <div class="cal-weekdays"><span>Su</span><span>M</span><span>Tu</span><span>W</span><span>Th</span><span>F</span><span>Sa</span></div>
        <div class="cal-grid-month">`;

      for (let i = 0; i < firstDay; i++) { html += `<div class="cal-day empty"></div>`; }

      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        let statusClass = '';
        if (academicCalendar.holidays && academicCalendar.holidays.includes(dateStr)) statusClass = 'holiday';
        else if (academicCalendar.importantDates && academicCalendar.importantDates.includes(dateStr)) statusClass = 'important';
        if (events.some(e => e.date === dateStr)) statusClass += ' has-event';

        const isSunday = new Date(year, month, i).getDay() === 0 ? 'sunday' : '';
        const isFuture = dateStr > todayStr ? 'future' : '';
        const isBeforeSemester = dateStr < academicCalendar.startDate ? 'before-semester' : '';
        const isMarked = markedDates.includes(dateStr) ? 'present' : '';
        const isBlocked = Boolean(isFuture || isBeforeSemester);
        html += `<div class="cal-day ${statusClass} ${isSunday} ${isFuture} ${isBeforeSemester} ${isMarked}" ${isBlocked ? 'aria-disabled="true"' : `onclick="toggleFullDayPresent('${dateStr}')"`}><span>${i}</span></div>`;
      }
      
      html += `</div>
        <div style="margin-top:20px; display:flex; justify-content:center; gap:15px; font-size:0.85rem; font-weight:700;">
          <span style="color:#9b2226">■ Holiday</span> 
          <span style="color:#005f73">■ Important</span>
          <span style="color:var(--present-btn)">■ Present</span>
        </div>`;
    }
  } else if (type === 'setTarget') {
    html += `
      <h2>Set Target Attendance</h2>
      <div style="text-align:left; margin-top:15px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <input type="number" id="targetInput" class="modal-input" style="margin-bottom: 0;" placeholder="e.g. 75" value="${targetPercentage || ''}" min="1" max="100" />
          <span style="font-size:1.2rem; font-weight:800;">%</span>
        </div>
        <button class="btn-present" style="width:100%; padding:12px;" onclick="saveTargetPercentage()">Save Target</button>
      </div>`;
  } else if (type === 'addCourse') {
    html += `
      <h2>Add Custom Course</h2>
      <div style="text-align:left; margin-top:15px;">
        <input type="text" id="newCourseName" class="modal-input" placeholder="Course Name" />
        <input type="text" id="newCourseCode" class="modal-input" placeholder="Course Code (Optional)" />
        <select id="newCourseDay" class="modal-input">
          <option value="Monday">Monday</option><option value="Tuesday">Tuesday</option>
          <option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option>
          <option value="Friday">Friday</option><option value="Saturday">Saturday</option>
        </select>
        <div style="display:flex; gap:10px;">
            <input type="time" id="newCourseStart" class="modal-input" />
            <input type="time" id="newCourseEnd" class="modal-input" />
        </div>
        <button class="btn-present" style="width:100%; padding:12px;" onclick="handleAddCourse()">Add Course</button>
      </div>`;
  } else if (type === 'editAttendance') {
    if (courses.length === 0) {
      html += `<h2>Edit Attendance</h2><p style="color:var(--text-sub); margin-top:15px;">No courses available.</p>`;
    } else {
      let options = courses.map(c => `<option value="${c.id}">${escapeEventText(c.name)}</option>`).join('');
      html += `
        <h2>Edit Attendance</h2>
        <div style="margin-top:15px; text-align: left;">
          <select id="editCourseSelect" class="modal-input" onchange="loadCourseToEdit()">${options}</select>
          <div style="display:flex; gap:15px; margin-bottom:20px;">
            <input type="number" id="editPresent" class="modal-input" placeholder="Present" oninput="syncEditFields('present')" />
            <input type="number" id="editTotal" class="modal-input" placeholder="Total" oninput="syncEditFields('total')" />
            <input type="number" id="editPercent" class="modal-input" placeholder="%" oninput="syncEditFields('percent')" />
          </div>
          <button class="btn-present" style="width:100%; padding:14px;" onclick="saveSingleCourseAttendance()">Save Changes</button>
        </div>`;
      setTimeout(loadCourseToEdit, 0); 
    }
  } else if (type === 'removeCourse') {
    html += `<h2>Remove Course</h2><div style="max-height: 55vh; overflow-y: auto; margin-top: 15px;">`;
    courses.forEach(c => {
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
          <span style="font-size:0.9rem; font-weight:700;">${escapeEventText(c.name)}</span>
          <button onclick="removeCourseById(${c.id})" style="background:var(--absent-btn); color:white; border:none; width:30px; height:30px; border-radius:50%; font-weight:bold; cursor:pointer;">×</button>
        </div>`;
    });
    html += `</div>`;
  }
  
  modalContent.innerHTML = html;
}

function loadCourseToEdit() {
  const select = document.getElementById('editCourseSelect');
  if (!select) return;
  const course = courses.find(c => String(c.id) === select.value);
  if (!course) return;
  const baseStats = getCalculatedAttendance();
  const totalPresent = Math.max(0, (baseStats[course.id]?.p || 0) + (course.present || 0));
  const totalAbsent = Math.max(0, (baseStats[course.id]?.a || 0) + (course.absent || 0));
  const total = totalPresent + totalAbsent;
  document.getElementById('editPresent').value = totalPresent;
  document.getElementById('editTotal').value = total;
  document.getElementById('editPercent').value = total === 0 ? 0 : Math.round((totalPresent / total) * 100);
}

function syncEditFields(source) {
  let p = parseFloat(document.getElementById('editPresent').value) || 0;
  let t = parseFloat(document.getElementById('editTotal').value) || 0;
  let pct = parseFloat(document.getElementById('editPercent').value) || 0;
  if (source === 'present' || source === 'total') {
    document.getElementById('editPercent').value = t > 0 ? Math.round((p / t) * 100) : 0;
  } else if (source === 'percent' && t > 0) {
    document.getElementById('editPresent').value = Math.round((pct / 100) * t);
  }
}

async function saveSingleCourseAttendance() {
  const select = document.getElementById('editCourseSelect');
  const course = courses.find(c => String(c.id) === select.value);
  if (!course) return;
  let p = parseInt(document.getElementById('editPresent').value, 10) || 0;
  let t = parseInt(document.getElementById('editTotal').value, 10) || 0;
  if (p > t) t = p;
  if (!(await confirmDataChange(`Save attendance changes for ${course.name} (present: ${p}, total: ${t})`, true))) return;
  const baseStats = getCalculatedAttendance();
  course.present = p - (baseStats[course.id]?.p || 0);
  course.absent = (t - p) - (baseStats[course.id]?.a || 0);
  addHistory(`Edited: ${course.name}`);
  saveToDatabase();
  renderUI();
  forceCloseModal();
}

async function handleAddCourse() {
  const name = document.getElementById('newCourseName').value.trim();
  const code = document.getElementById('newCourseCode').value.trim();
  const day = document.getElementById('newCourseDay').value;
  const start = document.getElementById('newCourseStart').value;
  const end = document.getElementById('newCourseEnd').value;
  if (!name) return alert("Please enter a course name.");
  if (!(await confirmDataChange(`Add the course “${name}”`, true))) return;
  let schedule = {};
  if (start && end) schedule[day] = [{ start: start, end: end }];
  courses.push({ id: Date.now(), name: name, code: code || 'CUSTOM', present: 0, absent: 0, schedule: schedule });
  addHistory(`Added Course: ${name}`); 
  saveToDatabase(); 
  renderUI(); 
  forceCloseModal();
}

async function saveTargetPercentage() {
  const newTarget = parseInt(document.getElementById('targetInput').value, 10);
  if (isNaN(newTarget) || newTarget < 1 || newTarget > 100) return alert("Enter valid % (1-100)");
  if (!(await confirmDataChange(`Save the attendance target as ${newTarget}%`, true))) return;
  targetPercentage = newTarget;
  localStorage.setItem('target_percentage', targetPercentage);
  saveToDatabase();
  renderUI();
  forceCloseModal();
}

async function removeCourseById(id) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  if (await confirmDataChange(`Remove the course “${course.name}”`, true)) {
    courses = courses.filter(c => c.id !== id);
    addHistory(`Removed Course: ${course.name}`);
    saveToDatabase(); 
    renderUI(); 
    openModal('removeCourse');
  }
}

// Authentication Handlers
async function loginWithGoogle() {
  if (!auth) return alert("Firebase not connected.");
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    forceCloseModal();
    alert(`Welcome, ${result.user.displayName || result.user.email}!`);
  } catch (error) {
    alert(error.message);
  }
}

async function loginWithEmail() {
  if (!auth) return alert("Firebase not connected.");
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPassword').value;
  if (!email || !pass) return alert("Please enter both email and password.");

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    forceCloseModal();
    alert("Signed in successfully!");
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      if (await showAppPrompt({
        kind: 'confirm',
        title: 'Create an account?',
        message: 'No account was found for this email. Create one now?',
        confirmText: 'Create account',
        cancelText: 'Cancel'
      })) {
        registerWithEmail(email, pass);
      }
    } else {
      alert(error.message);
    }
  }
}

async function registerWithEmail(email, pass) {
  if (!auth) return alert("Firebase not connected.");
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    forceCloseModal();
    alert("Account created and signed in!");
  } catch (error) {
    alert(error.message);
  }
}

async function logoutUser() {
  if (!auth) return;
  try {
    await auth.signOut();
    forceCloseModal();
    alert("Signed out. Sign in again to use the app.");
  } catch (error) {
    alert(error.message);
  }
}

// ==========================================
// 11. APP INITIALIZATION & STARTUP
// ==========================================
startLiveClock(); 
updateHolidayButton(); 
renderUI(); 
let dashboardResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(dashboardResizeTimer);
  dashboardResizeTimer = setTimeout(() => {
    if (isEditingTimetable) return;
    const active = document.activeElement;
    if (active?.matches('input, textarea, select, [contenteditable="true"]')) return;
    renderUI();
  }, 120);
}, { passive: true });
// Refresh the live timetable periodically without interrupting timetable edits.
setInterval(() => {
  const active = document.activeElement;
  const userIsEnteringData = active && (
    active.matches('input, textarea, select, [contenteditable="true"]') ||
    isEditingTimetable
  );
  if (!userIsEnteringData && currentTab === 'timetable') renderUI();
}, 1000); 

showFirstRunManual();
