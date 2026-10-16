// ==========================================
// 1. FIREBASE INITIALIZATION & CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDfzYCLN2b4SNsUPBL9CqPIWcSTH2WCt9c",
  authDomain: "attendance-tracker-2fe63.firebaseapp.com",
  projectId: "attendance-tracker-2fe63",
  storageBucket: "attendance-tracker-2fe63.firebasestorage.app",
  messagingSenderId: "266695080777",
  appId: "1:266695080777:web:a84408e4b87b9e37f77898"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userRole = 'student'; 
let userDocUnsubscribe = null

const DB_KEY = 'attendance_tracker_v43'; 
const HISTORY_KEY = 'attendance_history_v43';
const CALENDAR_KEY = 'academic_calendar_v43';
const MARKED_DATES_KEY = 'marked_dates_v43';
const MANUAL_SHOWN_KEY = 'appManualShown_v43';
const CUSTOM_DEFAULT_SCHEDULE_KEY = 'custom_default_timetable_v43';
const PRO_STATUS_KEY = 'attendance_app_is_pro_v1';
const VALID_ACCESS_KEYS = ['NMIT2026', 'CAMPUSPRO', 'ADMINFREE'];

// Navigation & Clock State
let currentTab = 'courses';
let isEditingTimetable = false;
let inlineEditSchedule = [];

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

function getTodayString() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

let currentSelectedDay = getTodayString();
let currentCalDate = new Date(); 

if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
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
  return [];
}

function loadFromDatabase() {
  const storedData = localStorage.getItem(DB_KEY);
  if (storedData) return JSON.parse(storedData);
  const defaultData = buildInitialDatabase();
  localStorage.setItem(DB_KEY, JSON.stringify(defaultData));
  return defaultData;
}

let courses = loadFromDatabase();

// ==========================================
// 2. CLOUD FIRESTORE & AUTH STATE
// ==========================================
function saveToDatabase() {
  localStorage.setItem(DB_KEY, JSON.stringify(courses));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyLog));
  localStorage.setItem(MARKED_DATES_KEY, JSON.stringify(markedDates));

  if (currentUser) {
    db.collection('users').doc(currentUser.uid).set({
      email: currentUser.email,
      courses: courses,
      historyLog: historyLog,
      markedDates: markedDates,
      academicCalendar: academicCalendar,
      targetPercentage: targetPercentage,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => console.error("Cloud save failed:", err));
  }
}

function addHistory(action) {
  const now = new Date();
  const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  historyLog.unshift({ time: timestamp, action });
  if (historyLog.length > 50) historyLog.pop(); 
  saveToDatabase();
}

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
  const authMenuItem = document.getElementById('authMenuItem');
  const adminMenuItem = document.getElementById('adminVerifyMenuItem');
  
  if (userDocUnsubscribe) {
    userDocUnsubscribe();
    userDocUnsubscribe = null;
  }

  if (user) {
    currentUser = user;
    if (authMenuItem) authMenuItem.innerHTML = `👤 ${user.displayName || user.email.split('@')[0]}`;
    await loadUserDataFromFirestore(user.uid);
    listenToUserDocRealtime(user.uid);
    
    const modalContent = document.getElementById('modalContent');
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay && modalOverlay.classList.contains('active') && modalContent && modalContent.classList.contains('auth-modal-card')) {
      closeModal();
    }
  } else {
    currentUser = null;
    userRole = 'student';
    localStorage.removeItem(PRO_STATUS_KEY);
    if (authMenuItem) authMenuItem.innerHTML = `🔑 Sign In / Account`;
    if (adminMenuItem) adminMenuItem.style.display = 'none';
    
    setTimeout(() => {
      openModal('authModal');
    }, 300);
  }
  
  checkLaunchPaywall();
  renderUI();
});

// Real-time listener: Unlocks the student immediately when Admin approves the payment
function listenToUserDocRealtime(uid) {
  userDocUnsubscribe = db.collection('users').doc(uid).onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      const adminMenuItem = document.getElementById('adminVerifyMenuItem');

      if (data.role === 'admin') {
        userRole = 'admin';
        localStorage.setItem(PRO_STATUS_KEY, 'true');
        if (adminMenuItem) adminMenuItem.style.display = 'block';
      } else if (data.isPro || data.role === 'pro') {
        userRole = 'pro';
        localStorage.setItem(PRO_STATUS_KEY, 'true');
        if (adminMenuItem) adminMenuItem.style.display = 'none';
      } else {
        userRole = 'student';
        localStorage.removeItem(PRO_STATUS_KEY);
        if (adminMenuItem) adminMenuItem.style.display = 'none';
      }
      checkLaunchPaywall();
    }
  });
}

async function loadUserDataFromFirestore(uid) {
  try {
    const userDocRef = db.collection('users').doc(uid);
    const doc = await userDocRef.get();

    if (doc.exists) {
      const data = doc.data();
      userRole = data.role || (data.isPro ? 'pro' : 'student');
      if (data.isPro || userRole === 'admin' || userRole === 'pro') {
        localStorage.setItem(PRO_STATUS_KEY, 'true');
      }
      if (data.courses) courses = data.courses;
      if (data.historyLog) historyLog = data.historyLog;
      if (data.markedDates) markedDates = data.markedDates;
      if (data.academicCalendar) academicCalendar = data.academicCalendar;
      if (data.targetPercentage) targetPercentage = data.targetPercentage;
      
      localStorage.setItem(DB_KEY, JSON.stringify(courses));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyLog));
      localStorage.setItem(MARKED_DATES_KEY, JSON.stringify(markedDates));
      if (academicCalendar) localStorage.setItem(CALENDAR_KEY, JSON.stringify(academicCalendar));
      if (targetPercentage) localStorage.setItem('target_percentage', targetPercentage);
    } else {
      await userDocRef.set({
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        role: 'student',
        isPro: false,
        courses: courses,
        historyLog: historyLog,
        markedDates: markedDates,
        academicCalendar: academicCalendar,
        targetPercentage: targetPercentage,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Firestore sync error:", err);
  }
}

// ==========================================
// 3. HARD PAYWALL & SECURE UTR VERIFICATION
// ==========================================
function isUserUnlocked() {
  if (currentUser) {
    return userRole === 'admin' || userRole === 'pro';
  }
  return false; // Require login and verification
}

function checkLaunchPaywall() {
  const paywallEl = document.getElementById('paywallOverlay');
  if (!paywallEl) return;

  if (isUserUnlocked()) {
    paywallEl.classList.remove('active');
    paywallEl.style.setProperty('display', 'none', 'important');
    
    const modalOverlay = document.getElementById('modalOverlay');
    const clockModal = document.getElementById('clockModalOverlay');
    const isModalOpen = (modalOverlay && modalOverlay.classList.contains('active')) || 
                        (clockModal && clockModal.classList.contains('active'));
    if (!isModalOpen) {
      document.body.classList.remove('scroll-locked');
    }
  } else {
    paywallEl.classList.add('active');
    paywallEl.style.setProperty('display', 'flex', 'important');
    document.body.classList.add('scroll-locked');
  }
}

function initiatePayment() {
  if (!currentUser) {
    alert("Please sign in with your email first so your semester pass can be linked to your account.");
    openModal('authModal');
    return;
  }

  const upiId = "8073510268@fam"; 
  const payeeName = "Attendance Tracker";
  const amount = "19.00";
  const note = `PASS_${currentUser.uid.substring(0, 5)}`;
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;

  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.className = 'modal-content';
  modalOverlay.classList.add('active');
  document.body.classList.add('scroll-locked');

  modalContent.innerHTML = `
    <button class="close-btn" onclick="closeModal()">×</button>
    <div style="text-align:center; padding: 5px;">
      <h2 style="font-size:1.3rem; margin-bottom:6px;">Step 1: Pay ₹9 via UPI</h2>
      <p style="font-size:0.85rem; color:var(--text-sub); margin-bottom:15px;">Tap the app button below or scan the QR code.</p>
      
      <div style="margin-bottom:15px;">
        <a href="${upiUrl}" style="display:inline-block; width:100%; padding:13px; background:#3498db; color:white; text-decoration:none; border-radius:12px; font-weight:800; font-size:0.95rem; box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);">
          📲 Open Installed UPI App
        </a>
      </div>

      <div style="margin: 12px 0;">
        <img src="${qrUrl}" alt="UPI QR" style="width:160px; height:160px; border-radius:10px; border:1px solid var(--border-color);" />
        <div style="font-size:0.75rem; color:var(--text-sub); margin-top:4px;">UPI ID: <b>${upiId}</b></div>
      </div>

      <hr style="border:none; border-top:1px dashed var(--border-color); margin: 15px 0;" />

      <h3 style="font-size:1.05rem; margin-bottom:6px;">Step 2: Submit 12-Digit UTR</h3>
      <p style="font-size:0.8rem; color:var(--text-sub); margin-bottom:12px;">Copy the <b>UPI Ref No. / UTR</b> from your GPay, PhonePe, or Paytm receipt:</p>
      
      <input type="text" id="paymentUtrInput" class="modal-input" placeholder="e.g. 428901234567" maxlength="12" style="text-align:center; font-weight:800; font-size:1.05rem; letter-spacing:1px; margin-bottom:10px;" />
      
      <div id="utrStatusMsg" style="font-size:0.8rem; font-weight:700; color:var(--absent-btn); margin-bottom:10px;"></div>

      <button class="vpopup-btn vpopup-btn-confirm" style="width:100%;" onclick="submitUtrForVerification()">
        ✓ Submit for Verification
      </button>
    </div>
  `;
}

// Submits UTR to Firestore instead of immediately granting access
async function submitUtrForVerification() {
  const utrInput = document.getElementById('paymentUtrInput');
  const statusMsg = document.getElementById('utrStatusMsg');
  const utr = (utrInput.value || '').trim();

  if (!/^\d{12}$/.test(utr)) {
    statusMsg.style.color = 'var(--absent-btn)';
    statusMsg.innerText = 'Please enter a valid 12-digit numeric UTR number.';
    return;
  }

  statusMsg.style.color = '#3498db';
  statusMsg.innerText = 'Submitting to database...';

  try {
    // Check if UTR was already submitted by someone else
    const existing = await db.collection('payment_verifications').doc(utr).get();
    if (existing.exists && existing.data().status === 'approved') {
      statusMsg.style.color = 'var(--absent-btn)';
      statusMsg.innerText = 'This UTR has already been used by an account.';
      return;
    }

    await db.collection('payment_verifications').doc(utr).set({
      utr: utr,
      uid: currentUser.uid,
      email: currentUser.email,
      name: currentUser.displayName || 'Student',
      amount: 19,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeModal();
    showVirtualPopup({
      icon: '⏳',
      title: 'Payment Under Review',
      message: `Your UTR <b>${utr}</b> was received! Your app will unlock automatically as soon as the admin confirms the credit.`,
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {}
    });

  } catch (err) {
    statusMsg.style.color = 'var(--absent-btn)';
    statusMsg.innerText = 'Submission error: ' + err.message;
  }
}

// Redeem custom promotion / activation keys
function redeemActivationKey() {
  const input = document.getElementById('activationKeyInput');
  const errorEl = document.getElementById('paywallError');
  const code = (input.value || '').trim().toUpperCase();

  if (VALID_ACCESS_KEYS.includes(code)) {
    errorEl.innerText = '';
    unlockApp();
  } else {
    errorEl.innerText = 'Invalid access code. Please try again.';
  }
}

function unlockApp() {
  localStorage.setItem(PRO_STATUS_KEY, 'true');
  userRole = (userRole === 'admin') ? 'admin' : 'pro';
  
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).set({
      isPro: true,
      role: userRole,
      unlockedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => console.error("Cloud pro update failed:", err));
  }

  const paywallEl = document.getElementById('paywallOverlay');
  if (paywallEl) {
    paywallEl.classList.remove('active');
    paywallEl.style.setProperty('display', 'none', 'important');
  }
  document.body.classList.remove('scroll-locked');
  alert("🎉 Access Unlocked! Welcome to Attendance Tracker.");
  renderUI();
}

function relockPaywallForTesting() {
  localStorage.removeItem(PRO_STATUS_KEY);
  if (currentUser) {
    userRole = 'student';
    db.collection('users').doc(currentUser.uid).set({
      isPro: false,
      role: 'student'
    }, { merge: true });
  }
  closeModal();
  checkLaunchPaywall();
}
window.relockPaywall = relockPaywallForTesting;

// ==========================================
// 4. INTERACTIVE CLOCK PICKER
// ==========================================
function openClockPicker(index, field) {
  clockTargetIndex = index;
  clockTargetField = field;
  
  const currentVal = inlineEditSchedule[index][field] || '09:00';
  const [h24, m24] = currentVal.split(':').map(Number);
  
  clockCurrentAmPm = h24 >= 12 ? 'PM' : 'AM';
  clockCurrentHour = h24 % 12 || 12;
  clockCurrentMinute = Math.round((m24 || 0) / 5) * 5 % 60;
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
  
  const paywallEl = document.getElementById('paywallOverlay');
  const isPaywallShowing = paywallEl && (paywallEl.classList.contains('active') || paywallEl.style.display === 'flex');
  if (!isPaywallShowing) {
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
  const radius = 80;
  const cx = 110, cy = 110;
  const hand = document.getElementById('clockHand');

  if (clockCurrentView === 'hours') {
    const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    hours.forEach(h => {
      const angle = (h * 30 - 90) * (Math.PI / 180);
      const x = cx + radius * Math.cos(angle) - 15;
      const y = cy + radius * Math.sin(angle) - 15;

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
    hand.style.transform = `rotate(${clockCurrentHour * 30}deg)`;
  } else {
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    minutes.forEach(m => {
      const angle = (m * 6 - 90) * (Math.PI / 180);
      const x = cx + radius * Math.cos(angle) - 15;
      const y = cy + radius * Math.sin(angle) - 15;

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
    hand.style.transform = `rotate(${clockCurrentMinute * 6}deg)`;
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
// 5. TIMETABLE EDITING & VIRTUAL POPUPS
// ==========================================
function showVirtualPopup({ icon = '📋', title, message, confirmText = '✓ Save', cancelText = '✖ No', onConfirm, onCancel }) {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.className = 'modal-content';
  modalOverlay.classList.add('active');
  document.body.classList.add('scroll-locked');
  
  modalContent.innerHTML = `
    <div class="vpopup-container">
      <div class="vpopup-icon">${icon}</div>
      <h3 class="vpopup-title">${title}</h3>
      <p class="vpopup-msg">${message}</p>
      <div class="vpopup-actions">
        ${cancelText ? `<button id="vpopupCancel" class="vpopup-btn vpopup-btn-cancel">${cancelText}</button>` : ''}
        <button id="vpopupConfirm" class="vpopup-btn vpopup-btn-confirm">${confirmText}</button>
      </div>
    </div>
  `;
  
  if (cancelText) {
    document.getElementById('vpopupCancel').onclick = () => {
      closeModal();
      if (onCancel) onCancel();
    };
  }
  document.getElementById('vpopupConfirm').onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
}

function toggleTimetableEdit() {
  if (isEditingTimetable) {
    for (let p of inlineEditSchedule) {
      if(!p.start || !p.end || !p.name.trim()) {
        return alert("Please fill all time and course name fields completely before saving.");
      }
      if(p.start >= p.end) {
        return alert("Start time must be before end time for " + (p.name || 'period') + ".");
      }
    }

    showVirtualPopup({
      icon: '💾',
      title: 'Save Timetable Changes?',
      message: `Do you want to save the updated schedule for <b>${currentSelectedDay}</b>?`,
      confirmText: '✓ Save',
      cancelText: '✖ No',
      onConfirm: () => {
        setTimeout(() => {
          showVirtualPopup({
            icon: '⚙️',
            title: 'Update Default Timetable?',
            message: `Do you also want to save this as the <b>default timetable</b>? (This will be restored if you click "Reset Default Timetable").`,
            confirmText: '✓ Save',
            cancelText: '✖ No',
            onConfirm: () => saveInlineTimetable(true),
            onCancel: () => saveInlineTimetable(false)
          });
        }, 200);
      }
    });

  } else {
    isEditingTimetable = true;
    inlineEditSchedule = [];
    courses.forEach(c => {
        if(c.schedule && c.schedule[currentSelectedDay]) {
            c.schedule[currentSelectedDay].forEach(slot => {
                inlineEditSchedule.push({ start: slot.start, end: slot.end, code: c.code, name: c.name, id: c.id });
            });
        }
    });
    inlineEditSchedule.sort((a,b) => a.start.localeCompare(b.start));
    renderUI();
  }
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
  courses.forEach(c => {
      if (c.schedule && c.schedule[currentSelectedDay]) {
          delete c.schedule[currentSelectedDay];
      }
  });
  
  inlineEditSchedule.forEach(p => {
      let course = courses.find(c => c.name.trim().toUpperCase() === p.name.trim().toUpperCase());
      if (!course) {
          course = { id: Date.now() + Math.random(), name: p.name.trim(), code: p.code || 'CUSTOM', present: 0, absent: 0, schedule: {} };
          courses.push(course);
      }
      if (!course.schedule) course.schedule = {};
      if (!course.schedule[currentSelectedDay]) course.schedule[currentSelectedDay] = [];
      course.schedule[currentSelectedDay].push({ start: p.start, end: p.end });
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
    message: 'Are you sure you want to completely clear your attendance logs and restore the default timetable schedule?',
    confirmText: '✓ Save',
    cancelText: '✖ No',
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
// 6. ATTENDANCE MATH & LIVE LOGGING
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

function toggleHoliday() {
  if (getTodayString() === 'Sunday') return; 
  const todayStr = getTodayDateString();
  if (localStorage.getItem('holiday_' + todayStr) === 'true') localStorage.removeItem('holiday_' + todayStr);
  else localStorage.setItem('holiday_' + todayStr, 'true');
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

              if (isFullDayMarked) {
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
      ? `<span class="bunk-meter bunk-safe">Safe to bunk ${buffer} class${buffer > 1 ? 'es' : ''}</span>`
      : `<span class="bunk-meter bunk-safe">On track (0 buffer)</span>`;
  } else {
    if (target >= 1) return `<span class="bunk-meter bunk-danger">Cannot reach 100%</span>`;
    const required = Math.ceil((((target * total) - present) / (1 - target)) - 0.0001);
    return `<span class="bunk-meter bunk-danger">Attend next ${required} class${required > 1 ? 'es' : ''}</span>`;
  }
}

function toggleSlotAttendance(courseId, slotStart, clickedStatus) {
  const todayStr = getTodayDateString();
  const slotKey = `${todayStr}_${courseId}_${slotStart}`;
  let dailyMarks = JSON.parse(localStorage.getItem('daily_marks_v41')) || {};
  const currentStatus = dailyMarks[slotKey];
  const course = courses.find(c => c.id === courseId);
  
  if (currentStatus === 'present') course.present--;
  if (currentStatus === 'absent') course.absent--;
  
  if (currentStatus === clickedStatus) {
      delete dailyMarks[slotKey];
  } else {
      if (clickedStatus === 'present') course.present++;
      if (clickedStatus === 'absent') course.absent++;
      dailyMarks[slotKey] = clickedStatus;
  }
  
  localStorage.setItem('daily_marks_v41', JSON.stringify(dailyMarks));
  saveToDatabase();
  checkAndAutoMarkDay(); 
  renderUI();
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
  }
}

// ==========================================
// 7. TAB ROUTING & CORE UI RENDERER
// ==========================================
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${tab}`).classList.add('active');
  if (tab === 'timetable') {
     currentSelectedDay = getTodayString(); 
     isEditingTimetable = false;
  }
  renderUI();
}

function changeDay(dayName) { 
  currentSelectedDay = dayName; 
  renderUI(); 
}

function renderUI() {
  const ttSection = document.getElementById('timetableSection');
  const courseSection = document.getElementById('courseList');
  
  if (currentTab === 'courses') {
      ttSection.style.setProperty('display', 'none', 'important');
      courseSection.style.setProperty('display', 'flex', 'important');
  } else {
      ttSection.style.setProperty('display', 'block', 'important');
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
              <input type="text" class="modal-input" style="margin:0; padding:12px; font-size: 0.95rem; font-weight:700;" value="${p.name}" placeholder="Full Course Name" onchange="updateInlinePeriod(${idx}, 'name', this.value)">
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
              
              inlineActions = `
              <div class="timeline-actions">
                 <button class="btn-card-action btn-present-slot ${presActive}" onclick="toggleSlotAttendance(${cls.id}, '${cls.start}', 'present')">PRESENT</button>
                 <button class="btn-card-action btn-absent-slot ${absActive}" onclick="toggleSlotAttendance(${cls.id}, '${cls.start}', 'absent')">ABSENT</button>
              </div>`;
            }

            html += `
              <div class="timeline-card ${status}">
                <div>
                  <div class="timeline-time">${indicator}${format12Hour(cls.start)} - ${format12Hour(cls.end)}</div>
                  <div class="timeline-course">${cls.name}</div>
                </div>
                ${inlineActions}
              </div>`;
          });
          timeContainer.innerHTML = html;
        }
      }
  }

  const listContainer = document.getElementById('courseList');
  listContainer.innerHTML = '';
  if (courses.length === 0) { 
    listContainer.innerHTML = `<p style="color:var(--text-sub); text-align:center; padding: 40px 0;">No Courses Found. Add courses from the sidebar menu.</p>`; 
    return; 
  }

  const holidayMode = isTodayHoliday() || getTodayString() === 'Sunday';
  const baseStats = getCalculatedAttendance();

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
        <div class="course-card" onclick="toggleActionBar(${course.id})">
          <div class="progress-circle">
            <svg width="80" height="80">
              <circle cx="40" cy="40" r="34" stroke="var(--absent-btn)" stroke-width="7" fill="transparent" />
              <circle cx="40" cy="40" r="34" stroke="var(--present-btn)" stroke-width="7" fill="transparent" stroke-dasharray="213.6" stroke-dashoffset="${dashOffset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease-in-out;" />
            </svg>
            <div class="percentage-text" style="color:var(--text-main); font-size:1.15rem;">${percentage}%</div>
          </div>
          <div class="course-info">
            <h2>${course.name}</h2>
            <p>Total Classes: ${total}</p>
            ${getBunkStatus(totalPresent, totalAbsent)}
          </div>
        </div>
        ${actionHTML}
      </div>`;
  });
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
// 8. MODALS & ADMIN APPROVAL DASHBOARD
// ==========================================
let setupBlobUrl = null;
let setupTempData = {};
let setupStartDate = null;
let setupEndDate = null;

function startCalendarSetup() {
  const fileInput = document.getElementById('calFileInput');
  setupStartDate = document.getElementById('termStart').value;
  setupEndDate = document.getElementById('termEnd').value;

  if (!fileInput.files.length || !setupStartDate || !setupEndDate) {
    return alert("Please upload a file and select both start and end dates.");
  }
  if (new Date(setupStartDate) > new Date(setupEndDate)) {
    return alert("Start date cannot be after the end date.");
  }

  const file = fileInput.files[0];
  setupBlobUrl = URL.createObjectURL(file);
  const previewWrapper = document.getElementById('previewWrapper');
  const isImage = file.type.match(/image/i) || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i);
  
  if (isImage) {
    previewWrapper.innerHTML = `<img id="setupImagePreview" src="${setupBlobUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:contain;" alt="Calendar Preview" />`;
  } else {
    previewWrapper.innerHTML = `<iframe src="${setupBlobUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; background:white;"></iframe>`;
  }
  
  setupTempData = {}; 
  if (academicCalendar) {
    if (academicCalendar.holidays) academicCalendar.holidays.forEach(d => setupTempData[d] = 'holiday');
    if (academicCalendar.importantDates) academicCalendar.importantDates.forEach(d => setupTempData[d] = 'important');
  }

  buildSetupCalendar(setupStartDate, setupEndDate);
  closeModal();
  document.getElementById('splitScreenOverlay').classList.add('active');
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

function saveSetupCalendar() {
  let holidays = [];
  let importantDates = [];
  for (const [date, type] of Object.entries(setupTempData)) {
    if (type === 'holiday') holidays.push(date);
    if (type === 'important') importantDates.push(date);
  }
  academicCalendar = { startDate: setupStartDate, endDate: setupEndDate, holidays: holidays, importantDates: importantDates };
  localStorage.setItem(CALENDAR_KEY, JSON.stringify(academicCalendar));
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
}

function changeCalendarMonth(dir) {
  currentCalDate.setDate(1); 
  currentCalDate.setMonth(currentCalDate.getMonth() + dir);
  openModal('calendarMode');
}

function toggleFullDayPresent(dateString) {
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

function toggleMenu() { 
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open'); 
  document.getElementById('menuOverlay').classList.toggle('active'); 
  document.body.classList.toggle('scroll-locked', sidebar.classList.contains('open'));
}

function closeModal(e) { 
  if (e && e.target !== document.getElementById('modalOverlay') && !e.target.classList.contains('close-btn')) return; 
  document.getElementById('modalOverlay').classList.remove('active'); 
  const modalContent = document.getElementById('modalContent');
  if (modalContent) modalContent.className = 'modal-content';
  
  const paywallEl = document.getElementById('paywallOverlay');
  const isPaywallShowing = paywallEl && (paywallEl.classList.contains('active') || paywallEl.style.display === 'flex');
  if (!isPaywallShowing) {
    document.body.classList.remove('scroll-locked');
  }
}

// Admin Verification Modal Handler
async function openAdminVerifyModal() {
  const modalContent = document.getElementById('modalContent');
  modalContent.className = 'modal-content';
  modalContent.innerHTML = `
    <button class="close-btn" onclick="closeModal()">×</button>
    <h2>Pending UPI Payments</h2>
    <p style="font-size:0.85rem; color:var(--text-sub); margin-bottom:15px;">Check incoming ₹19 credits in your GPay/PhonePe and match the 12-digit UTR:</p>
    <div id="adminRequestsList" style="max-height: 50vh; overflow-y:auto;">Loading requests...</div>
  `;

  try {
    const snapshot = await db.collection('payment_verifications')
      .where('status', '==', 'pending')
      .get();

    const listEl = document.getElementById('adminRequestsList');
    if (snapshot.empty) {
      listEl.innerHTML = `<p style="color:var(--text-sub); text-align:center; padding: 25px 0;">No pending payments to review.</p>`;
      return;
    }

    let html = '';
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      html += `
        <div style="background:var(--bg-color); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:10px; text-align:left;">
          <div style="font-weight:800; font-size:0.95rem; color:var(--text-main);">${data.email}</div>
          <div style="font-size:0.8rem; color:var(--text-sub); margin: 3px 0;">UTR: <b style="letter-spacing:1px; color:#3498db;">${data.utr}</b></div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="vpopup-btn vpopup-btn-confirm" style="padding:6px 12px; font-size:0.8rem;" onclick="adminApprovePayment('${docSnap.id}', '${data.uid}')">✓ Approve</button>
            <button class="vpopup-btn vpopup-btn-cancel" style="padding:6px 12px; font-size:0.8rem;" onclick="adminRejectPayment('${docSnap.id}')">✖ Reject</button>
          </div>
        </div>
      `;
    });
    listEl.innerHTML = html;
  } catch (err) {
    document.getElementById('adminRequestsList').innerHTML = `<p style="color:var(--absent-btn); font-size:0.85rem;">Error loading: ${err.message}</p>`;
  }
}

async function adminApprovePayment(utr, studentUid) {
  try {
    // 1. Mark verification document approved
    await db.collection('payment_verifications').doc(utr).update({
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Unlock the student's cloud profile (triggers real-time unlock on their phone)
    await db.collection('users').doc(studentUid).set({
      isPro: true,
      role: 'pro',
      unlockedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    alert(`UTR ${utr} approved! Student account unlocked.`);
    openAdminVerifyModal();
  } catch (err) {
    alert("Approval failed: " + err.message);
  }
}

async function adminRejectPayment(utr) {
  if (!confirm(`Reject UTR ${utr}?`)) return;
  try {
    await db.collection('payment_verifications').doc(utr).update({
      status: 'rejected',
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Payment rejected.");
    openAdminVerifyModal();
  } catch (err) {
    alert("Rejection failed: " + err.message);
  }
}

function openModal(type) {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('menuOverlay').classList.remove('active');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalOverlay.classList.add('active');
  document.body.classList.add('scroll-locked');
  
  if (type === 'authModal') {
    modalContent.className = 'modal-content auth-modal-card';
  } else {
    modalContent.className = 'modal-content';
  }

  if (type === 'adminVerifyModal') {
    openAdminVerifyModal();
    return;
  }

  let html = `<button class="close-btn" onclick="closeModal()">×</button>`;

  if (type === 'authModal') {
    if (currentUser) {
      html += `
        <h2>Student Account</h2>
        <div style="text-align:center; padding:15px 0;">
          <p style="font-size:1.15rem; font-weight:700; color:var(--text-main);">${currentUser.displayName || 'Student'}</p>
          <p style="font-size:0.9rem; color:var(--text-sub); margin-bottom:15px;">${currentUser.email}</p>
          <div style="display:inline-block; padding:6px 14px; border-radius:20px; font-size:0.8rem; font-weight:700; background:${userRole === 'admin' ? 'var(--absent-btn)' : (userRole === 'pro' ? 'var(--present-btn)' : '#3498db')}; color:white; margin-bottom:20px;">
            ${userRole === 'admin' ? '🛡️ Administrator' : (userRole === 'pro' ? '🎓 Pro Pass Active' : 'Basic Account')}
          </div>
          <p style="font-size:0.85rem; color:var(--text-sub); margin-bottom:20px;">Your attendance data is synced with Cloud Firestore.</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <button class="vpopup-btn vpopup-btn-cancel" style="width:100%;" onclick="logoutUser()">Sign Out</button>
            <button class="vpopup-btn vpopup-btn-cancel" style="width:100%; background:#7f8c8d !important;" onclick="relockPaywallForTesting()">🔒 Re-lock Paywall (Test)</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <h2>Student Sign In</h2>
        <p style="font-size:0.9rem; color:var(--text-sub); margin:10px 0 20px 0;">Sign in to back up your courses and verify your semester pass.</p>
        
        <button class="btn-present" style="width:100%; padding:14px; background:#4285F4; margin-bottom:15px; display:flex; align-items:center; justify-content:center; gap:10px;" onclick="loginWithGoogle()">
          <span style="font-weight:900;">G</span> Continue with Google
        </button>
        
        <div style="text-align:center; margin:15px 0; color:var(--text-sub); font-size:0.8rem; font-weight:700;">OR USE EMAIL</div>
        
        <input type="email" id="authEmail" class="modal-input" placeholder="College Email" />
        <input type="password" id="authPassword" class="modal-input" placeholder="Password" />
        
        <div style="display:flex; gap:10px;">
          <button class="btn-present" style="flex:1; padding:12px;" onclick="loginWithEmail()">Sign In</button>
          <button class="btn-present" style="flex:1; padding:12px; background:var(--bg-color); color:var(--text-main); border:1px solid var(--border-color);" onclick="registerWithEmail(document.getElementById('authEmail').value, document.getElementById('authPassword').value)">Register</button>
        </div>
      `;
    }
  } else if (type === 'userManual') {
    html += `
      <h2>How to Use This App</h2>
      <div style="max-height: 60vh; overflow-y: auto; text-align: left; margin-top:10px;">
        <h3 style="font-size:1rem; margin-top:10px;">1. Navigation</h3>
        <p style="font-size:0.85rem; color:var(--text-sub);">Use the bottom bar to switch between <b>Attendance %</b> and the daily <b>Timetable</b>.</p>
        <h3 style="font-size:1rem; margin-top:10px;">2. Mark Live Attendance</h3>
        <p style="font-size:0.85rem; color:var(--text-sub);">Tap Present or Absent directly on today's classes in the Timetable tab.</p>
        <h3 style="font-size:1rem; margin-top:10px;">3. Edit Timetable</h3>
        <p style="font-size:0.85rem; color:var(--text-sub);">Tap ✏️ to customize today's schedule with the interactive clock picker, then set it as your default schedule.</p>
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
      <h2>Upload Academic Calendar</h2>
      <div style="text-align:left; margin-top:15px;">
        <label style="font-size:0.85rem; color:var(--text-sub);">Select Calendar (Image or PDF)</label>
        <input type="file" id="calFileInput" accept="image/*, application/pdf" class="modal-input" />
        <label style="font-size:0.85rem; color:var(--text-sub);">Term Start Date</label>
        <input type="date" id="termStart" class="modal-input" />
        <label style="font-size:0.85rem; color:var(--text-sub);">Term End Date</label>
        <input type="date" id="termEnd" class="modal-input" />
        <button class="btn-present" style="width:100%; padding:12px;" onclick="startCalendarSetup()">Start Setup Mode</button>
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

        const isSunday = new Date(year, month, i).getDay() === 0 ? 'sunday' : '';
        const isFuture = dateStr > todayStr ? 'future' : '';
        const isMarked = markedDates.includes(dateStr) ? 'present' : '';
        html += `<div class="cal-day ${statusClass} ${isSunday} ${isFuture} ${isMarked}" onclick="toggleFullDayPresent('${dateStr}')"><span>${i}</span></div>`;
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
      let options = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
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
          <span style="font-size:0.9rem; font-weight:700;">${c.name}</span>
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
  const course = courses.find(c => c.id === parseInt(select.value, 10));
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

function saveSingleCourseAttendance() {
  const select = document.getElementById('editCourseSelect');
  const course = courses.find(c => c.id === parseInt(select.value, 10));
  if (!course) return;
  let p = parseInt(document.getElementById('editPresent').value, 10) || 0;
  let t = parseInt(document.getElementById('editTotal').value, 10) || 0;
  if (p > t) t = p;
  const baseStats = getCalculatedAttendance();
  course.present = p - (baseStats[course.id]?.p || 0);
  course.absent = (t - p) - (baseStats[course.id]?.a || 0);
  addHistory(`Edited: ${course.name}`);
  saveToDatabase();
  renderUI();
  closeModal();
}

function handleAddCourse() {
  const name = document.getElementById('newCourseName').value.trim();
  const code = document.getElementById('newCourseCode').value.trim();
  const day = document.getElementById('newCourseDay').value;
  const start = document.getElementById('newCourseStart').value;
  const end = document.getElementById('newCourseEnd').value;
  if (!name) return alert("Please enter a course name.");
  let schedule = {};
  if (start && end) schedule[day] = [{ start: start, end: end }];
  courses.push({ id: Date.now(), name: name, code: code || 'CUSTOM', present: 0, absent: 0, schedule: schedule });
  addHistory(`Added Course: ${name}`); 
  saveToDatabase(); 
  renderUI(); 
  closeModal();
}

function saveTargetPercentage() {
  const newTarget = parseInt(document.getElementById('targetInput').value, 10);
  if (isNaN(newTarget) || newTarget < 1 || newTarget > 100) return alert("Enter valid % (1-100)");
  targetPercentage = newTarget;
  localStorage.setItem('target_percentage', targetPercentage);
  renderUI();
  closeModal();
}

function removeCourseById(id) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  if (confirm(`Remove ${course.name}?`)) {
    courses = courses.filter(c => c.id !== id);
    addHistory(`Removed Course: ${course.name}`);
    saveToDatabase(); 
    renderUI(); 
    openModal('removeCourse');
  }
}

// Authentication Handlers
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    closeModal();
    alert(`Welcome, ${result.user.displayName || result.user.email}!`);
  } catch (error) {
    alert(error.message);
  }
}

async function loginWithEmail() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPassword').value;
  if (!email || !pass) return alert("Please enter both email and password.");

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    closeModal();
    alert("Signed in successfully!");
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      if (confirm("Account not found. Create a new account with this email?")) {
        registerWithEmail(email, pass);
      }
    } else {
      alert(error.message);
    }
  }
}

async function registerWithEmail(email, pass) {
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    closeModal();
    alert("Account created and signed in!");
  } catch (error) {
    alert(error.message);
  }
}

async function logoutUser() {
  try {
    await auth.signOut();
    closeModal();
    alert("Signed out. Operating in offline mode.");
  } catch (error) {
    alert(error.message);
  }
}

// ==========================================
// 9. APP INITIALIZATION & STARTUP
// ==========================================
startLiveClock(); 
updateHolidayButton(); 
checkLaunchPaywall();
renderUI(); 
setInterval(renderUI, 60000); 

if (!localStorage.getItem(MANUAL_SHOWN_KEY)) { 
  localStorage.setItem(MANUAL_SHOWN_KEY, 'true'); 
  setTimeout(() => openModal('userManual'), 300);
}