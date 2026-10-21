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

// Global User & Role States
let currentUser = null;
let userRole = 'student'; 
let userDocUnsubscribe = null;
let settingsUnsubscribe = null;
let subscriptionPrice = parseInt(localStorage.getItem('subscription_price'), 10) || 20;
let authMode = 'signin'; 

// ==========================================
// 2. STATE KEYS & GLOBAL VARIABLES
// ==========================================
let currentSemester = localStorage.getItem('current_semester_v1') || 'Semester 1';

function getSemKey(prefix) {
  return `${prefix}_${currentSemester.replace(/\s+/g, '_').toLowerCase()}`;
}

const EVENTS_KEY = 'app_events_log_v1';
const HISTORY_KEY = 'attendance_history_v43';
const CALENDAR_KEY = 'academic_calendar_v43';
const PRO_STATUS_KEY = 'attendance_app_is_pro_v1';
const MANUAL_SHOWN_KEY = 'appManualShown_v43';

let currentTab = 'courses';
let isEditingTimetable = false;
let inlineEditSchedule = [];

// Clock Picker Globals
let clockTargetIndex = null;
let clockTargetField = null;
let clockCurrentHour = 9;
let clockCurrentMinute = 0;
let clockCurrentAmPm = 'AM';
let clockCurrentView = 'hours';

// Data Arrays
let targetPercentage = parseInt(localStorage.getItem('target_percentage'), 10) || 75;
let historyLog = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let academicCalendar = JSON.parse(localStorage.getItem(CALENDAR_KEY)) || null;

let courses = JSON.parse(localStorage.getItem(getSemKey('db_courses'))) || [];
let markedDates = JSON.parse(localStorage.getItem(getSemKey('marked_dates'))) || [];
let eventsLog = JSON.parse(localStorage.getItem(EVENTS_KEY)) || [];

// Calendar & Date Globals
let currentSelectedDay = getTodayString();
let currentCalDate = new Date(); 

function getTodayString() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

function getTodayDateString() {
  const now = new Date(); 
  return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

function format12Hour(time24) {
  if (!time24) return '';
  let [h, m] = time24.split(':');
  h = parseInt(h, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// ==========================================
// 3. STORAGE & CLOUD DATABASE SYNC
// ==========================================
function saveToDatabase() {
  localStorage.setItem(getSemKey('db_courses'), JSON.stringify(courses));
  localStorage.setItem(getSemKey('marked_dates'), JSON.stringify(markedDates));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyLog));
  localStorage.setItem(EVENTS_KEY, JSON.stringify(eventsLog));

  if (currentUser && db) {
    db.collection('users').doc(currentUser.uid).set({
      email: currentUser.email,
      currentSemester: currentSemester,
      [`semesters.${currentSemester.replace(/\s+/g, '_')}`]: {
        courses: courses,
        markedDates: markedDates
      },
      events: eventsLog,
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

function switchSemester(newSem) {
  currentSemester = newSem;
  localStorage.setItem('current_semester_v1', newSem);
  
  courses = JSON.parse(localStorage.getItem(getSemKey('db_courses'))) || [];
  markedDates = JSON.parse(localStorage.getItem(getSemKey('marked_dates'))) || [];
  
  addHistory(`Switched view to ${newSem}`);
  renderUI();
}

// ==========================================
// 4. FIREBASE AUTH & REAL-TIME LISTENERS
// ==========================================
if (auth) {
  auth.onAuthStateChanged(async (user) => {
    const authMenuItem = document.getElementById('authMenuItem');
    const adminMenuItem = document.getElementById('adminVerifyMenuItem');
    
    if (userDocUnsubscribe) {
      userDocUnsubscribe();
      userDocUnsubscribe = null;
    }

    if (user) {
      currentUser = user;
      if (authMenuItem) authMenuItem.innerHTML = `🔑 ${user.displayName || user.email.split('@')[0]}`;
      await loadUserDataFromFirestore(user.uid);
      listenToUserDocRealtime(user.uid);
      forceCloseModal();
    } else {
      currentUser = null;
      userRole = 'student';
      localStorage.removeItem(PRO_STATUS_KEY);
      if (authMenuItem) authMenuItem.innerHTML = `🔑 Sign In / Account`;
      if (adminMenuItem) adminMenuItem.style.display = 'none';
      setTimeout(() => openModal('authModal'), 300);
    }
    checkLaunchPaywall();
    renderUI();
  });
}

function listenToUserDocRealtime(uid) {
  if (!db) return;
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
  if (!db) return;
  try {
    const userDocRef = db.collection('users').doc(uid);
    const doc = await userDocRef.get();

    if (doc.exists) {
      const data = doc.data();
      userRole = data.role || (data.isPro ? 'pro' : 'student');
      if (data.isPro || userRole === 'admin' || userRole === 'pro') {
        localStorage.setItem(PRO_STATUS_KEY, 'true');
      }
      
      const semData = data.semesters ? data.semesters[currentSemester.replace(/\s+/g, '_')] : null;
      if (semData && semData.courses) courses = semData.courses;
      if (semData && semData.markedDates) markedDates = semData.markedDates;
      
      if (data.historyLog) historyLog = data.historyLog;
      if (data.events) eventsLog = data.events;
      if (data.academicCalendar) academicCalendar = data.academicCalendar;
      if (data.targetPercentage) targetPercentage = data.targetPercentage;
      
      saveToDatabase();
    } else {
      await userDocRef.set({
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        role: 'student',
        isPro: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (err) {
    console.warn("Firestore sync error:", err);
  }
}

// ==========================================
// 5. PAYWALL ENFORCEMENT
// ==========================================
function isUserUnlocked() {
  if (localStorage.getItem(PRO_STATUS_KEY) === 'true') return true;
  if (currentUser && (userRole === 'admin' || userRole === 'pro')) {
    localStorage.setItem(PRO_STATUS_KEY, 'true');
    return true;
  }
  return false;
}

function checkLaunchPaywall() {
  const paywallEl = document.getElementById('paywallOverlay');
  if (!paywallEl) return;

  if (isUserUnlocked()) {
    paywallEl.classList.remove('active');
    paywallEl.style.setProperty('display', 'none', 'important');
    if (!document.getElementById('settingsPage').classList.contains('open')) {
      document.body.classList.remove('scroll-locked');
    }
  } else {
    paywallEl.classList.add('active');
    paywallEl.style.setProperty('display', 'flex', 'important');
    document.body.classList.add('scroll-locked');
  }
}

function saveSubscriptionPrice() {
  if (!db) return alert("Firebase not connected.");
  const input = document.getElementById('adminPriceInput');
  const newPrice = parseInt(input.value, 10);
  if (isNaN(newPrice) || newPrice < 1) return alert("Please enter a valid amount.");

  db.collection('app_settings').doc('config').set({ price: newPrice }, { merge: true }).then(() => {
    subscriptionPrice = newPrice;
    localStorage.setItem('subscription_price', newPrice);
    alert(`Price successfully set to ₹${newPrice}!`);
  }).catch(err => alert("Failed to update price: " + err.message));
}

// ==========================================
// 6. ATTENDANCE MATH & CALCULATION HELPERS
// ==========================================
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
  const total = present + absent;
  if (total === 0) return `<span class="bunk-meter" style="color:var(--text-sub);">No classes held</span>`;

  const pct = (present / total) * 100;

  if (pct >= targetPercentage) {
    const buffer = Math.floor(((present / (targetPercentage / 100)) - total));
    return buffer > 0 
      ? `<span class="bunk-meter bunk-safe">Safe to bunk ${Math.max(0, buffer)} classes</span>`
      : `<span class="bunk-meter bunk-safe">On track (0 buffer)</span>`;
  } else {
    if ((targetPercentage / 100) >= 1) return `<span class="bunk-meter bunk-danger">Cannot reach 100%</span>`;
    const required = Math.ceil((((targetPercentage / 100 * total) - present) / (1 - (targetPercentage / 100))));
    return `<span class="bunk-meter bunk-danger">Attend next ${required} classes</span>`;
  }
}

function isTodayHoliday() {
  const todayStr = getTodayDateString();
  const manualHoliday = localStorage.getItem('holiday_' + todayStr) === 'true';
  const calendarHoliday = academicCalendar && academicCalendar.holidays && academicCalendar.holidays.includes(todayStr);
  return manualHoliday || calendarHoliday;
}

function isTodayHoliday() {
  const todayStr = getTodayDateString();
  const manualHoliday = localStorage.getItem('holiday_' + todayStr) === 'true';
  const calendarHoliday = academicCalendar && academicCalendar.holidays && academicCalendar.holidays.includes(todayStr);
  return manualHoliday || calendarHoliday;
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
    btn.innerText = 'Mark Holiday'; 
    btn.style.pointerEvents = 'auto';
  }
}

function isTodayHoliday() {
  const todayStr = getTodayDateString();
  const manualHoliday = localStorage.getItem('holiday_' + todayStr) === 'true';
  const calendarHoliday = academicCalendar && academicCalendar.holidays && academicCalendar.holidays.includes(todayStr);
  return manualHoliday || calendarHoliday;
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
    btn.innerText = 'Mark Holiday'; 
    btn.style.pointerEvents = 'auto';
  }
}

function isTodayHoliday() {
  const todayStr = getTodayDateString();
  const manualHoliday = localStorage.getItem('holiday_' + todayStr) === 'true';
  const calendarHoliday = academicCalendar && academicCalendar.holidays && academicCalendar.holidays.includes(todayStr);
  return manualHoliday || calendarHoliday;
}

function updateHolidayButton() {
  const btn = document.querySelector('.holiday-btn');
  if (!btn) return;
  const todayStr = getTodayDateString();
  
  if (getTodayString() === 'Sunday') {
    btn.classList.add('active');
    btn.innerText = '🏖️ SUNDAY - HOLIDAY';
    btn.style.pointerEvents = 'none'; 
  } else if (localStorage.getItem('holiday_' + todayStr) === 'true' || (academicCalendar && academicCalendar.holidays && academicCalendar.holidays.includes(todayStr))) { 
    btn.classList.add('active'); 
    btn.innerText = '🏖️ MARKED AS HOLIDAY'; 
    btn.style.pointerEvents = 'auto';
  } else { 
    btn.classList.remove('active'); 
    btn.innerText = '🏖️ Mark Holiday'; 
    btn.style.pointerEvents = 'auto';
  }
}

function toggleHoliday() {
  const todayStr = getTodayDateString();
  if (localStorage.getItem('holiday_' + todayStr) === 'true') {
    localStorage.removeItem('holiday_' + todayStr);
  } else {
    localStorage.setItem('holiday_' + todayStr, 'true');
  }
  renderUI();
}

function toggleFullDayPresent(dateStr) {
  const todayStr = getTodayDateString();
  
  if (dateStr > todayStr) {
    return alert("You cannot mark attendance for future dates.");
  }

  const idx = markedDates.indexOf(dateStr);
  if (idx > -1) {
    markedDates.splice(idx, 1);
  } else {
    markedDates.push(dateStr);
  }
  
  saveToDatabase();
  openModal('calendarMode');
  renderUI();
}

function markAllPresentToday() {
  const todayName = getTodayString();
  const todayStr = getTodayDateString();

  let totalClasses = 0;
  courses.forEach(c => {
    if (c.schedule && c.schedule[todayName] && c.schedule[todayName].length > 0) {
      c.schedule[todayName].forEach(slot => {
        totalClasses++;
        let slotKey = `${todayStr}_${c.id}_${slot.start}`;
        let dailyMarks = JSON.parse(localStorage.getItem('daily_marks_v41')) || {};
        dailyMarks[slotKey] = 'present';
        localStorage.setItem('daily_marks_v41', JSON.stringify(dailyMarks));
      });
      c.present = (c.present || 0) + c.schedule[todayName].length;
    }
  });

  if (totalClasses === 0) return alert(`No classes scheduled for today (${todayName}).`);

  if (!markedDates.includes(todayStr)) markedDates.push(todayStr);

  addHistory(`One-tap: Marked all ${totalClasses} classes present for ${todayStr}`);
  saveToDatabase();
  renderUI();

  showVirtualPopup({
    icon: '⚡',
    title: 'All Classes Marked Present!',
    message: `All ${totalClasses} classes for <b>${todayName}</b> were successfully logged as Present.`,
    confirmText: 'Done',
    cancelText: '',
    onConfirm: () => {}
  });
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
  renderUI();
}

function markAttendance(id, status) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  if (status === 'present') course.present = (course.present || 0) + 1;
  else course.absent = (course.absent || 0) + 1;
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
// 7. TIMETABLE EDITING FUNCTIONS
// ==========================================
function toggleTimetableEdit() {
  if (isEditingTimetable) {
    saveInlineTimetable();
  } else {
    isEditingTimetable = true;
    inlineEditSchedule = [];
    courses.forEach(c => {
      if (c.schedule && c.schedule[currentSelectedDay]) {
        c.schedule[currentSelectedDay].forEach(slot => {
          inlineEditSchedule.push({ start: slot.start, end: slot.end, name: c.name });
        });
      }
    });
    inlineEditSchedule.sort((a,b) => a.start.localeCompare(b.start));
    renderUI();
  }
}

function addInlinePeriod() {
  inlineEditSchedule.push({ start: '09:00', end: '10:00', name: '' });
  renderUI();
}

function updateInlinePeriod(index, field, value) {
  inlineEditSchedule[index][field] = value;
}

function removeInlinePeriod(index) {
  inlineEditSchedule.splice(index, 1);
  renderUI();
}

function saveInlineTimetable() {
  for (let p of inlineEditSchedule) {
    if(!p.start || !p.end || !p.name.trim()) return alert("Fill all course names and times before saving.");
    if(p.start >= p.end) return alert("Start time must be before end time for " + (p.name || 'period') + ".");
  }

  courses.forEach(c => {
    if (c.schedule && c.schedule[currentSelectedDay]) {
      delete c.schedule[currentSelectedDay];
    }
  });
  
  inlineEditSchedule.forEach(p => {
    let course = courses.find(c => c.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    if (!course) {
      course = { id: Date.now() + Math.random(), name: p.name.trim(), code: 'CUSTOM', present: 0, absent: 0, schedule: {} };
      courses.push(course);
    }
    if (!course.schedule) course.schedule = {};
    if (!course.schedule[currentSelectedDay]) course.schedule[currentSelectedDay] = [];
    course.schedule[currentSelectedDay].push({ start: p.start, end: p.end });
  });

  addHistory(`Updated timetable for ${currentSelectedDay}`);
  saveToDatabase();
  isEditingTimetable = false;
  renderUI();
}

function changeDay(dayName) { 
  currentSelectedDay = dayName; 
  isEditingTimetable = false;
  renderUI(); 
}

// ==========================================
// 8. REPORTS (PDF & CSV)
// ==========================================
function exportAttendanceCSV() {
  if (courses.length === 0) return alert("No course data available to export.");

  const baseStats = getCalculatedAttendance();
  let csv = "Course Name,Course Code,Present,Absent,Total Classes,Attendance %,Bunk Status\n";

  courses.forEach(c => {
    const p = Math.max(0, (baseStats[c.id]?.p || 0) + (c.present || 0));
    const a = Math.max(0, (baseStats[c.id]?.a || 0) + (c.absent || 0));
    const total = p + a;
    const pct = total === 0 ? 0 : Math.round((p / total) * 100);
    const status = pct >= targetPercentage ? "On Track" : "Attendance Shortage";
    csv += `"${c.name}","${c.code || 'N/A'}",${p},${a},${total},${pct}%,${status}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_Report_${currentSemester.replace(/\s+/g, '_')}_${getTodayDateString()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function printAttendanceReport() {
  if (courses.length === 0) return alert("No course data available to print.");

  const baseStats = getCalculatedAttendance();
  let rowsHtml = '';
  let overallP = 0, overallT = 0;

  courses.forEach(c => {
    const p = Math.max(0, (baseStats[c.id]?.p || 0) + (c.present || 0));
    const a = Math.max(0, (baseStats[c.id]?.a || 0) + (c.absent || 0));
    const total = p + a;
    const pct = total === 0 ? 0 : Math.round((p / total) * 100);
    overallP += p;
    overallT += total;

    rowsHtml += `
      <tr style="border-bottom: 1px solid #ddd; text-align: left;">
        <td style="padding: 10px 8px;"><b>${c.name}</b> (${c.code || 'CUSTOM'})</td>
        <td style="padding: 10px 8px; text-align: center;">${p}</td>
        <td style="padding: 10px 8px; text-align: center;">${total}</td>
        <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: ${pct < targetPercentage ? '#c0392b' : '#27ae60'};">${pct}%</td>
        <td style="padding: 10px 8px;">${pct >= targetPercentage ? 'Eligible' : 'Shortage'}</td>
      </tr>
    `;
  });

  const overallPct = overallT === 0 ? 0 : Math.round((overallP / overallT) * 100);

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Attendance Report - ${currentSemester}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 1.5rem; text-transform: uppercase; }
        .header p { margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem; }
        .meta-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9rem; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 0.85rem; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
        .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
        .sign-area { display: flex; justify-content: space-between; margin-top: 60px; font-size: 0.9rem; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Official Attendance Performance Report</h1>
        <p>${currentSemester} • Generated on ${new Date().toLocaleDateString()}</p>
      </div>

      <div class="meta-info">
        <div><b>Student:</b> ${currentUser ? (currentUser.displayName || currentUser.email) : 'Verified Student'}</div>
        <div><b>Target Attendance:</b> ${targetPercentage}%</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Course Description</th>
            <th style="text-align:center;">Attended</th>
            <th style="text-align:center;">Total Held</th>
            <th style="text-align:center;">Percentage</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="summary-card">
        <b>Overall Cumulative Attendance:</b> ${overallP} / ${overallT} (${overallPct}%) 
        — Status: <b>${overallPct >= targetPercentage ? 'SAFE & ELIGIBLE' : 'ATTENDANCE SHORTAGE WARNING'}</b>
      </div>

      <div class="sign-area">
        <div>________________________<br>Student Signature</div>
        <div>________________________<br>Mentor / Faculty Advisor</div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ==========================================
// 9. EVENTS, DEADLINES & LIVE TICKER
// ==========================================
function saveNewEvent() {
  const title = (document.getElementById('newEventTitle').value || '').trim();
  const date = document.getElementById('newEventDate').value;
  const category = document.getElementById('newEventCategory').value;

  if (!title || !date) return alert("Please fill event title and date.");

  const newEvent = {
    id: 'evt_' + Date.now(),
    title: title,
    date: date,
    category: category,
    createdAt: new Date().toISOString()
  };

  eventsLog.push(newEvent);
  addHistory(`Added event: ${title} on ${date}`);
  saveToDatabase();
  forceCloseModal();
  renderUI();
}

function deleteEvent(eventId) {
  eventsLog = eventsLog.filter(e => e.id !== eventId);
  addHistory(`Deleted an event`);
  saveToDatabase();
  renderUI();
}

function renderEventsList() {
  const listEl = document.getElementById('eventsList');
  const urgentBanner = document.getElementById('urgentEventTitle');
  if (!listEl) return;

  const filter = document.getElementById('eventFilterSelect')?.value || 'all';
  const sort = document.getElementById('eventSortSelect')?.value || 'date-asc';
  const todayStr = getTodayDateString();

  let filtered = [...eventsLog];

  if (filter === 'upcoming') filtered = filtered.filter(e => e.date >= todayStr);
  else if (filter === 'past') filtered = filtered.filter(e => e.date < todayStr);
  else if (filter !== 'all') filtered = filtered.filter(e => e.category === filter);

  filtered.sort((a, b) => {
    return sort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  });

  const upcomingEvents = eventsLog.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date));
  if (upcomingEvents.length > 0) {
    const nextEvt = upcomingEvents[0];
    const daysDiff = Math.ceil((new Date(nextEvt.date) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
    const dayLabel = daysDiff === 0 ? "TODAY" : (daysDiff === 1 ? "TOMORROW" : `In ${daysDiff} days`);
    urgentBanner.innerText = `🚨 ${nextEvt.title} (${dayLabel} • ${nextEvt.date})`;
  } else {
    urgentBanner.innerText = "No urgent events in the queue.";
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<p style="color:var(--text-sub); text-align:center; padding:30px;">No events match the selected filter.</p>`;
    return;
  }

  let html = '';
  filtered.forEach(e => {
    const isPast = e.date < todayStr;
    html += `
      <div class="event-card ${isPast ? 'past' : ''}">
        <div>
          <div class="event-info-title">
            ${e.title}
            <span class="event-category-badge">${e.category}</span>
          </div>
          <div class="event-info-date">📅 ${new Date(e.date).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short', year: 'numeric' })}</div>
        </div>
        <button onclick="deleteEvent('${e.id}')" style="background:none; border:none; color:var(--text-sub); font-size:1.2rem; cursor:pointer;" title="Delete Event">🗑️</button>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

// ==========================================
// 10. COURSE MILESTONES (EXAMS/ASSIGNMENTS)
// ==========================================
function openCourseMilestones(courseId) {
  const course = courses.find(c => c.id === courseId);
  if (!course) return;

  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.className = 'modal-content';
  modalOverlay.classList.add('active');
  document.body.classList.add('scroll-locked');

  let listHtml = '';
  (course.milestones || []).forEach((m, idx) => {
    listHtml += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-color); border-radius:10px; margin-bottom:8px; border:1px solid var(--border-color);">
        <div><b style="color:var(--text-main); font-size:0.95rem;">${m.title}</b> <span style="font-size:0.7rem; background:#3498db; color:#fff; padding:2px 6px; border-radius:6px; font-weight:800;">${m.type}</span><div style="font-size:0.8rem; color:var(--text-sub); margin-top:3px; font-weight:800;">Due: ${m.date}</div></div>
        <button onclick="deleteMilestone(${course.id}, ${idx})" style="background:none; border:none; cursor:pointer; font-size:1.1rem;">🗑️</button>
      </div>`;
  });

  modalContent.innerHTML = `
    <button class="close-btn" onclick="forceCloseModal()">×</button>
    <h2 style="margin-bottom:15px;">${course.name} Milestones</h2>
    <div style="margin: 15px 0;">${listHtml || '<p style="color:var(--text-sub); font-size:0.85rem;">No assessments logged.</p>'}</div>
    <hr style="border:none; border-top:1px dashed var(--border-color); margin:15px 0;">
    <h3 style="font-size:0.95rem; margin-bottom:8px; font-weight:800;">Add Assessment / Exam</h3>
    <input type="text" id="newMilestoneTitle" class="modal-input" placeholder="e.g. Internal Test 1" />
    <input type="date" id="newMilestoneDate" class="modal-input" value="${getTodayDateString()}" />
    <select id="newMilestoneType" class="modal-input funky-select">
      <option value="Exam">Exam</option><option value="Assignment">Assignment</option><option value="Quiz">Quiz</option>
    </select>
    <button class="btn-auth-primary" style="width:100%; padding:12px; margin-top:8px;" onclick="saveMilestone(${course.id})">+ Add Milestone</button>
  `;
}

function saveMilestone(courseId) {
  const course = courses.find(c => c.id === courseId);
  const title = document.getElementById('newMilestoneTitle').value.trim();
  const date = document.getElementById('newMilestoneDate').value;
  const type = document.getElementById('newMilestoneType').value;
  if (!title || !date) return alert("Fill assessment title and date.");

  if (!course.milestones) course.milestones = [];
  course.milestones.push({ title, date, type });
  saveToDatabase();
  openCourseMilestones(courseId);
}

function deleteMilestone(courseId, idx) {
  const course = courses.find(c => c.id === courseId);
  course.milestones.splice(idx, 1);
  saveToDatabase();
  openCourseMilestones(courseId);
}

// ==========================================
// 11. PWA / CLASS START WEB NOTIFICATIONS
// ==========================================
let notificationPermissionGranted = ("Notification" in window) && Notification.permission === "granted";
let sentNotificationSlots = {};

function requestNotificationPermission() {
  closeSettingsPage();
  if (!("Notification" in window)) {
    return alert("This browser does not support desktop/push notifications.");
  }

  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      notificationPermissionGranted = true;
      alert("✓ Class start notifications enabled! You'll be alerted 10 minutes before class.");
    } else {
      alert("Notification access was denied. Enable notifications in site settings.");
    }
  });
}

function checkClassStartNotifications() {
  if (!notificationPermissionGranted) return;

  const todayName = getTodayString();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStr = getTodayDateString();

  courses.forEach(c => {
    if (c.schedule && c.schedule[todayName]) {
      c.schedule[todayName].forEach(slot => {
        const [h, m] = slot.start.split(':').map(Number);
        const slotMinutes = h * 60 + m;
        const diff = slotMinutes - currentMinutes;

        // Trigger notification between 5 and 10 minutes before start
        if (diff > 0 && diff <= 10) {
          const notifKey = `${todayStr}_${c.id}_${slot.start}`;
          if (!sentNotificationSlots[notifKey]) {
            sentNotificationSlots[notifKey] = true;
            new Notification(`Class in ${diff} minutes: ${c.name}`, {
              body: `Scheduled at ${format12Hour(slot.start)} (${slot.start} - ${slot.end})`,
              icon: 'icon-192.png'
            });
          }
        }
      });
    }
  });
}

// ==========================================
// 12. CORE RENDERING ENGINE & VIEWS
// ==========================================
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${tab}`).classList.add('active');

  const courseSection = document.getElementById('coursesSection');
  const ttSection = document.getElementById('timetableSection');
  const eventsSection = document.getElementById('eventsSection');

  if(courseSection) courseSection.style.display = tab === 'courses' ? 'block' : 'none';
  if(ttSection) ttSection.style.display = tab === 'timetable' ? 'block' : 'none';
  if(eventsSection) eventsSection.style.display = tab === 'events' ? 'block' : 'none';

  if (tab === 'timetable') {
    currentSelectedDay = getTodayString();
    isEditingTimetable = false;
  }
  renderUI();
}

function renderUI() {
  // Update semester selector
  const semSelect = document.getElementById('semesterSelect');
  if (semSelect) semSelect.value = currentSemester;

  if (typeof updateHolidayButton === 'function') updateHolidayButton();

  document.querySelectorAll('.day-selector button').forEach(btn => {
    btn.classList.remove('active-day');
    if (btn.innerText.startsWith(currentSelectedDay.substring(0, 3))) {
      btn.classList.add('active-day');
    }
  });

  // 1. Critical shortage banner
  const globalAlert = document.getElementById('criticalGlobalBanner');
  const baseStats = getCalculatedAttendance();
  let criticalCount = 0;

  courses.forEach(c => {
    const p = Math.max(0, (baseStats[c.id]?.p || 0) + (c.present || 0));
    const a = Math.max(0, (baseStats[c.id]?.a || 0) + (c.absent || 0));
    const t = p + a;
    if (t > 0 && Math.round((p / t) * 100) < targetPercentage) {
      criticalCount++;
    }
  });

  if (criticalCount > 0 && globalAlert) {
    globalAlert.style.display = 'flex';
    globalAlert.innerHTML = `⚠️ <b>Critical Warning:</b> You have ${criticalCount} course${criticalCount > 1 ? 's' : ''} below your ${targetPercentage}% attendance target!`;
  } else if (globalAlert) {
    globalAlert.style.display = 'none';
  }

  // 2. Render Courses
  const listContainer = document.getElementById('courseList');
  if (listContainer) {
    listContainer.innerHTML = '';
    if (courses.length === 0) {
      listContainer.innerHTML = `<p style="color:var(--text-sub); text-align:center; padding: 40px 0;">No courses found in ${currentSemester}. Add subjects from the Settings ⚙️ menu.</p>`;
    } else {
      courses.forEach(course => {
        const totalPresent = Math.max(0, (baseStats[course.id]?.p || 0) + (course.present || 0));
        const totalAbsent = Math.max(0, (baseStats[course.id]?.a || 0) + (course.absent || 0));
        const total = totalPresent + totalAbsent;
        const percentage = total === 0 ? 0 : Math.round((totalPresent / total) * 100);
        const dashOffset = (2 * Math.PI * 34) - ((percentage / 100) * (2 * Math.PI * 34));

        const isShortage = total > 0 && percentage < targetPercentage;
        const shortageBadge = isShortage ? `<span class="critical-badge">SHORTAGE (<${targetPercentage}%)</span>` : '';

        listContainer.innerHTML += `
          <div class="course-card-wrapper">
            <div class="course-card ${isShortage ? 'critical-shortage' : ''}" onclick="toggleActionBar(${course.id})">
              <div class="progress-circle">
                <svg width="80" height="80">
                  <circle cx="40" cy="40" r="34" stroke="var(--absent-btn)" stroke-width="7" fill="transparent" />
                  <circle cx="40" cy="40" r="34" stroke="var(--present-btn)" stroke-width="7" fill="transparent" stroke-dasharray="213.6" stroke-dashoffset="${dashOffset}" stroke-linecap="round" />
                </svg>
                <div class="percentage-text" style="color:var(--text-main); font-size:1.15rem;">${percentage}%</div>
              </div>
              <div class="course-info">
                <h2>${course.name}</h2>
                <p>Classes: ${totalPresent}/${total}</p>
                ${getBunkStatus(totalPresent, totalAbsent)}
                ${shortageBadge}
                <div class="course-card-actions-row">
                  <button class="course-util-btn" onclick="event.stopPropagation(); openModal('whatIfSimulator', ${course.id})">🧮 Simulate</button>
                  <button class="course-util-btn" onclick="event.stopPropagation(); openCourseMilestones(${course.id})">🎯 Milestones</button>
                </div>
              </div>
            </div>
            <div class="action-bar" id="action-${course.id}">
              <button class="btn-present" onclick="markAttendance(${course.id}, 'present')">PRESENT</button>
              <button class="btn-absent" onclick="markAttendance(${course.id}, 'absent')">ABSENT</button>
            </div>
          </div>`;
      });
    }
  }

  // 3. Render Timetable
  const timeContainer = document.getElementById('timetableContainer');
  const editBtn = document.getElementById('editTimetableBtn');
  if (timeContainer) {
    if (isEditingTimetable) {
      editBtn.innerText = '💾';
      timeContainer.className = 'timetable-edit-mode';
      let editHtml = '';
      inlineEditSchedule.forEach((p, idx) => {
        editHtml += `
          <div style="background:var(--card-bg); padding:16px; border-radius:12px; display:flex; flex-direction:column; gap:10px; border:1px solid var(--border-color);">
            <div style="display:flex; gap:10px; align-items:center;">
              <button type="button" class="time-picker-btn" onclick="openClockPicker(${idx}, 'start')">🕒 ${format12Hour(p.start) || 'Start'}</button>
              <span style="font-weight:800; color:var(--text-sub);">to</span>
              <button type="button" class="time-picker-btn" onclick="openClockPicker(${idx}, 'end')">🕒 ${format12Hour(p.end) || 'End'}</button>
              <button onclick="removeInlinePeriod(${idx})" style="background:var(--absent-btn); color:white; border:none; border-radius:8px; padding:12px 16px; cursor:pointer;">×</button>
            </div>
            <input type="text" class="modal-input" style="margin:0; padding:12px;" value="${p.name}" placeholder="Course Name" onchange="updateInlinePeriod(${idx}, 'name', this.value)">
          </div>`;
      });
      editHtml += `<button style="padding:15px; width:100%; border:1px dashed var(--primary-accent); background:var(--bg-color); color:var(--primary-accent); border-radius:12px; cursor:pointer; font-weight:800;" onclick="addInlinePeriod()">+ Add Class to ${currentSelectedDay}</button>`;
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
        timeContainer.innerHTML = `<div class="holiday-banner"><p style="color:var(--absent-btn); font-size:1.15rem; font-weight:800;">🏖️ ${isSunday ? 'SUNDAY IS A HOLIDAY' : 'TODAY IS A HOLIDAY'}</p></div>`;
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
          timeContainer.innerHTML = `<p style="color:var(--text-sub); text-align:center; padding:25px; font-weight:700;">No classes scheduled for ${currentSelectedDay}.</p>`;
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
  }

  // 4. Render Events
  renderEventsList();
}

// ==========================================
// 13. SETTINGS PAGE & MODAL CONTROLLERS
// ==========================================
function openSettingsPage() {
  const gear = document.getElementById('gearBtn');
  if (gear) gear.classList.add('rotate');
  
  document.getElementById('settingsPage').classList.add('open');
  document.body.classList.add('scroll-locked');
}

function closeSettingsPage() {
  const gear = document.getElementById('gearBtn');
  if (gear) gear.classList.remove('rotate');
  
  document.getElementById('settingsPage').classList.remove('open');
  
  const paywallEl = document.getElementById('paywallOverlay');
  const isPaywallShowing = paywallEl && (paywallEl.classList.contains('active') || paywallEl.style.display === 'flex');
  if (!isPaywallShowing) {
    document.body.classList.remove('scroll-locked');
  }
}

// Master Modals Router
function openModal(type, extraId = null) {
  // Always close the settings drawer smoothly before sliding up a modal
  closeSettingsPage();

  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalOverlay.classList.add('active');
  document.body.classList.add('scroll-locked');
  
  // Set default class
  modalContent.className = 'modal-content';

  if (type === 'authModal') {
    modalContent.className = 'modal-content auth-modal-card';
  }

  // Intercept Admin Verify
  if (type === 'adminVerifyModal') {
    openAdminVerifyModal();
    return;
  }

  let html = `<button class="close-btn" onclick="forceCloseModal()">×</button>`;

  if (type === 'setSemesterDates') {
    const sDate = academicCalendar?.startDate || '';
    const eDate = academicCalendar?.endDate || '';
    html += `
      <h2>Set Semester Dates</h2>
      <div style="text-align:left; margin-top:15px;">
        <label style="font-size:0.8rem; font-weight:800; color:var(--text-main);">Semester Start Date</label>
        <input type="date" id="semStartInput" class="modal-input" value="${sDate}" />
        <label style="font-size:0.8rem; font-weight:800; color:var(--text-main);">Semester End Date</label>
        <input type="date" id="semEndInput" class="modal-input" value="${eDate}" />
        <button class="btn-auth-primary" style="width:100%; margin-top:8px;" onclick="saveSemesterDates()">Save Dates</button>
      </div>
    `;
  } 
  else if (type === 'whatIfSimulator') {
    if (extraId) simSelectedCourseId = extraId;
    else if (!simSelectedCourseId && courses.length > 0) simSelectedCourseId = courses[0].id;
    
    let options = courses.map(c => `<option value="${c.id}" ${c.id == simSelectedCourseId ? 'selected' : ''}>${c.name}</option>`).join('');
    html += `
      <h2>Bunk Simulator</h2>
      <p style="font-size:0.82rem; color:var(--text-sub); margin-bottom:14px;">Forecast your attendance percentage.</p>
      
      <select id="simCoursePicker" class="modal-input funky-select" onchange="simSelectedCourseId=this.value; updateWhatIfCalculation();">
        ${options}
      </select>

      <div class="simulator-box">
        <div class="sim-metric-row">
          <div class="sim-metric-item">
            <span class="sim-metric-val" id="simNewPercentage">--%</span>
            <span class="sim-metric-label">Projected %</span>
          </div>
        </div>

        <div class="sim-control-group">
          <label><span>Will Attend:</span> <span id="simAttendDisplay">+0</span></label>
          <input type="range" id="simAttendSlider" class="sim-range-slider" min="0" max="25" value="0" oninput="updateWhatIfCalculation()">
        </div>

        <div class="sim-control-group">
          <label><span>Will Miss:</span> <span id="simMissDisplay">+0</span></label>
          <input type="range" id="simMissSlider" class="sim-range-slider" min="0" max="25" value="0" oninput="updateWhatIfCalculation()">
        </div>

        <div id="simVerdict" style="margin-top:10px; font-size:0.85rem; background:#1e293b; padding:8px; border-radius:8px;"></div>
      </div>
    `;
    setTimeout(updateWhatIfCalculation, 0);
  } 
  else if (type === 'calendarMode') {
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
      if (academicCalendar?.holidays?.includes(dateStr)) statusClass = 'holiday';
      else if (academicCalendar?.importantDates?.includes(dateStr)) statusClass = 'important';

      const isSunday = new Date(year, month, i).getDay() === 0 ? 'sunday' : '';
      const isFuture = dateStr > todayStr ? 'future' : '';
      const isMarked = markedDates.includes(dateStr) ? 'present' : '';
      const isEventDay = eventsLog.some(e => e.date === dateStr) ? 'event-day' : '';

      html += `<div class="cal-day ${statusClass} ${isSunday} ${isFuture} ${isMarked} ${isEventDay}" onclick="toggleFullDayPresent('${dateStr}')"><span>${i}</span></div>`;
    }
    
    html += `</div>
      <div style="margin-top:20px; display:flex; justify-content:center; gap:12px; font-size:0.8rem; font-weight:700; flex-wrap:wrap;">
        <span style="color:#9b2226">■ Holiday</span> 
        <span style="color:#005f73">■ Important</span>
        <span style="color:var(--present-btn)">■ Present</span>
        <span style="color:#d97706">■ Event (Yellow)</span>
      </div>`;
  } 
  else if (type === 'authModal') {
    if (currentUser) {
      let adminPricingSection = '';
      if (userRole === 'admin') {
        adminPricingSection = `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin: 24px 0; text-align:left;">
            <div style="font-weight:700; font-size:0.95rem; color:#0f172a; margin-bottom:4px;">Subscription Price Setting</div>
            <p style="font-size:0.8rem; color:#64748b; margin-bottom:16px;">Set the semester fee for all students (in ₹):</p>
            <div style="display:flex; gap:10px;">
              <input type="number" id="adminPriceInput" style="flex:1; padding:10px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem; outline:none; color:#0f172a;" value="${subscriptionPrice}" min="1" />
              <button style="flex:none; background:#2563eb; color:#ffffff; border:none; padding:10px 20px; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.95rem;" onclick="saveSubscriptionPrice()">Save</button>
            </div>
          </div>
        `;
      }

      html += `
        <div style="text-align:center; padding:10px 0;">
          <div style="width: 56px; height: 56px; background: #e8f0fe; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 1.8rem;">
            👨🏽‍💻
          </div>
          <h2 style="font-family: 'Lato', sans-serif; font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-bottom: 6px; letter-spacing:0px !important;">${currentUser.displayName || 'Student'}</h2>
          <p style="font-size:0.95rem; color:#64748b; margin-bottom:16px;">${currentUser.email}</p>
          
          <div style="display:inline-block; padding:4px 16px; border-radius:20px; font-size:0.75rem; font-weight:700; background:${userRole === 'admin' ? '#fce8e6' : (userRole === 'pro' ? '#e6f4ea' : '#e8f0fe')}; color:${userRole === 'admin' ? '#d93025' : (userRole === 'pro' ? '#137333' : '#1a73e8')}; margin-bottom:20px;">
            ${userRole === 'admin' ? 'Administrator' : (userRole === 'pro' ? 'Pro Pass Active' : 'Basic Account')}
          </div>
          
          ${adminPricingSection}

          <button style="width:100%; padding:14px; background:#ffffff; color:#0f172a; border:1px solid #e2e8f0; border-radius:12px; font-size:1rem; font-weight:800; cursor:pointer; margin-top:10px; transition:all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'" onclick="logoutUser()">
            Sign Out
          </button>
        </div>
      `;
    } else {
      const isRegister = (authMode === 'register');
      html += `
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-family: 'Lato', sans-serif; font-size: 1.6rem; font-weight: 800; margin-bottom: 8px;">
            ${isRegister ? 'Create your account' : 'Sign in'}
          </h2>
          <p class="auth-subtext">to continue to Attendance Tracker</p>
        </div>

        <div class="auth-input-group">
          <label>Email</label>
          <input type="email" id="authEmail" placeholder="Enter your email" autocomplete="email" />
        </div>

        <div class="auth-input-group">
          <label>Password</label>
          <input type="password" id="authPassword" placeholder="Enter your password" autocomplete="current-password" />
        </div>

        <div class="auth-switch-prompt">
          ${isRegister 
            ? `Already have an account? <a onclick="switchAuthMode('signin')">Sign in</a>` 
            : `No account? <a onclick="switchAuthMode('register')">Create account</a>`}
        </div>

        <button class="btn-auth-primary" onclick="${isRegister ? "registerWithEmail(document.getElementById('authEmail').value, document.getElementById('authPassword').value)" : "loginWithEmail()"}">
          ${isRegister ? 'Sign up' : 'Sign in'}
        </button>

        <div class="auth-divider">
          <span>OR</span>
        </div>

        <button class="btn-google-oauth" onclick="loginWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.8.54-1.83.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A8.99 8.99 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.71V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .96 4.96l3.01 2.33c.71-2.13 2.69-3.71 5.03-3.71z"/>
          </svg>
          Continue with Google
        </button>
      `;
    }
  } 
  else if (type === 'setupCalendar') {
    html += `
      <h2>Sync Academic Calendar</h2>
      <div style="text-align:left; margin-top:15px;">
        <label style="font-size:0.8rem; font-weight:800; color:var(--text-main);">(Optional) Reference File</label>
        <input type="file" id="calFileInput" accept="image/*, application/pdf" class="modal-input" />
        <label style="font-size:0.8rem; font-weight:800; color:var(--text-main);">Term Start Date</label>
        <input type="date" id="termStart" class="modal-input" />
        <label style="font-size:0.8rem; font-weight:800; color:var(--text-main);">Term End Date</label>
        <input type="date" id="termEnd" class="modal-input" />
        <button class="funky-button" style="width:100%; margin-top:8px;" onclick="startCalendarSetup()">Start Setup Mode</button>
      </div>`;
  } 
  else if (type === 'userManual') {
    html += `
      <h2>How to Use This App</h2>
      <div style="max-height: 60vh; overflow-y: auto; text-align: left; margin-top:10px;">
        <h3 style="font-size:1rem; margin-top:10px;">1. Navigation</h3>
        <p style="font-size:0.85rem; color:var(--text-sub);">Use the bottom bar to switch between <b>Attendance %</b>, <b>Timetable</b>, and <b>Events</b>.</p>
        <h3 style="font-size:1rem; margin-top:10px;">2. Mark Live Attendance</h3>
        <p style="font-size:0.85rem; color:var(--text-sub);">Tap Present or Absent directly on today's classes in the Timetable tab. Or hit <b>⚡ Mark All Present</b>.</p>
        <h3 style="font-size:1rem; margin-top:10px;">3. Edit Timetable</h3>
        <p style="font-size:0.85rem; color:var(--text-sub);">Tap ✏️ to customize today's schedule with the interactive clock picker.</p>
        <h3 style="font-size:1rem; margin-top:10px;">4. Settings & Overrides</h3>
        <p style="font-size:0.85rem; color:var(--text-sub);">Tap the gear icon ⚙️ to add courses manually, edit specific attendance numbers, view logs, or reset the semester.</p>
      </div>`;
  } 
  else if (type === 'setTarget') {
    html += `
      <h2>Set Target Attendance</h2>
      <div style="margin-top:15px;">
        <input type="number" id="targetInput" class="modal-input" placeholder="e.g. 75" value="${targetPercentage || ''}" min="1" max="100" />
        <button class="funky-button" style="width:100%; padding:14px;" onclick="saveTargetPercentage()">Save Target</button>
      </div>`;
  } 
  else if (type === 'addCourse') {
    html += `
      <h2>Add Course</h2>
      <div style="margin-top:15px;">
        <input type="text" id="newCourseName" class="modal-input" placeholder="Course Name" />
        <input type="text" id="newCourseCode" class="modal-input" placeholder="Course Code (e.g. CS302)" />
        <select id="newCourseDay" class="modal-input funky-select">
          <option value="Monday">Monday</option><option value="Tuesday">Tuesday</option>
          <option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option>
          <option value="Friday">Friday</option><option value="Saturday">Saturday</option>
        </select>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <input type="time" id="newCourseStart" class="modal-input" />
          <input type="time" id="newCourseEnd" class="modal-input" />
        </div>
        <button class="funky-button" style="width:100%; padding:14px;" onclick="handleAddCourse()">Add Course</button>
      </div>`;
  } 
  else if (type === 'historyLog') {
    html += `<h2>Activity Log</h2><div class="history-list" style="max-height:300px; overflow-y:auto; margin-top:15px; border:2px solid #000; border-radius:12px; padding:10px;">`;
    if (historyLog.length === 0) {
      html += `<p style="color:var(--text-sub); font-size:0.85rem;">No history recorded yet.</p>`;
    } else {
      historyLog.forEach(l => {
        html += `<div style="padding:10px 0; border-bottom:1px dashed var(--border-color); font-size:0.85rem; display:flex; justify-content:space-between; font-weight:800;"><span>${l.action}</span><span style="color:var(--text-sub); font-size:0.75rem;">${l.time}</span></div>`;
      });
    }
    html += `</div>`;
  } 
  else if (type === 'editAttendance') {
    if (courses.length === 0) {
      html += `<h2>Edit Attendance</h2><p style="color:var(--text-sub); margin-top:15px;">No courses available.</p>`;
    } else {
      let options = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      html += `
        <h2>Edit Attendance</h2>
        <div style="margin-top:15px; text-align: left;">
          <select id="editCourseSelect" class="modal-input funky-select" onchange="loadCourseToEdit()">${options}</select>
          <div style="display:flex; gap:15px; margin-bottom:20px;">
            <input type="number" id="editPresent" class="modal-input" placeholder="Present" oninput="syncEditFields('present')" />
            <input type="number" id="editTotal" class="modal-input" placeholder="Total" oninput="syncEditFields('total')" />
            <input type="number" id="editPercent" class="modal-input" placeholder="%" oninput="syncEditFields('percent')" />
          </div>
          <button class="funky-button" style="width:100%; padding:14px;" onclick="saveSingleCourseAttendance()">Save Changes</button>
        </div>`;
      setTimeout(loadCourseToEdit, 0); 
    }
  } 
  else if (type === 'removeCourse') {
    html += `<h2>Remove Course</h2><div style="max-height: 55vh; overflow-y: auto; margin-top: 15px;">`;
    if (courses.length === 0) {
      html += `<p style="color:var(--text-sub); font-size:0.85rem;">No courses to remove.</p>`;
    } else {
      courses.forEach(c => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border:2px solid var(--border-color); border-radius:12px; padding:10px 14px;">
            <span style="font-size:0.9rem; font-weight:900;">${c.name}</span>
            <button onclick="removeCourseById(${c.id})" style="background:var(--absent-btn); color:white; border:2px solid #000; box-shadow: 2px 2px 0px #000; width:34px; height:34px; border-radius:10px; font-weight:900; cursor:pointer;">×</button>
          </div>`;
      });
    }
    html += `</div>`;
  } 
  else if (type === 'addEvent') {
    html += `
      <h2>Add Upcoming Event</h2>
      <p style="font-size:0.85rem; color:var(--text-sub); margin-bottom:15px;">Event dates turn <b>vibrant yellow</b> on the calendar.</p>
      
      <label style="font-size:0.8rem; font-weight:800;">Event Title</label>
      <input type="text" id="newEventTitle" class="modal-input" placeholder="e.g. Mid-Term Exam / Fest" />

      <label style="font-size:0.8rem; font-weight:800;">Date</label>
      <input type="date" id="newEventDate" class="modal-input" value="${getTodayDateString()}" />

      <label style="font-size:0.8rem; font-weight:800;">Category</label>
      <select id="newEventCategory" class="modal-input funky-select">
        <option value="Exam">Exam / Internal</option>
        <option value="Assignment">Assignment Submission</option>
        <option value="Fest">Campus Fest / Workshop</option>
        <option value="Holiday">College Holiday</option>
        <option value="Personal">Personal Event</option>
      </select>

      <button class="funky-button" style="width:100%; padding:14px; margin-top:8px;" onclick="saveNewEvent()">Save Event</button>
    `;
  }

  modalContent.innerHTML = html;
}

function openAddEventModal() {
  openModal('addEvent');
}

function forceCloseModal() {
  const m = document.getElementById('modalOverlay');
  if (m) m.classList.remove('active');
  const c = document.getElementById('modalContent');
  if (c) c.innerHTML = '';
  
  const paywallEl = document.getElementById('paywallOverlay');
  const isPaywallShowing = paywallEl && (paywallEl.classList.contains('active') || paywallEl.style.display === 'flex');
  if (!isPaywallShowing && !document.getElementById('settingsPage').classList.contains('open')) {
    document.body.classList.remove('scroll-locked');
  }
}

function closeModal(e) {
  if (e && e.target === document.getElementById('modalOverlay')) forceCloseModal();
}

function showVirtualPopup({ icon, title, message, confirmText, cancelText, onConfirm }) {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.className = 'modal-content';
  modalOverlay.classList.add('active');
  modalContent.innerHTML = `
    <div class="vpopup-container">
      <div class="vpopup-icon">${icon}</div>
      <h3 class="vpopup-title">${title}</h3>
      <p class="vpopup-msg">${message}</p>
      <div class="vpopup-actions">
        ${cancelText ? `<button class="vpopup-btn vpopup-btn-cancel funky-button" style="background:var(--absent-btn); color:#fff;" onclick="forceCloseModal()">${cancelText}</button>` : ''}
        <button class="vpopup-btn vpopup-btn-confirm funky-button" style="background:var(--present-btn); color:#fff;" id="vpopConfirmBtn">${confirmText}</button>
      </div>
    </div>`;
  document.getElementById('vpopConfirmBtn').onclick = () => {
    forceCloseModal();
    if (onConfirm) onConfirm();
  };
}

// ==========================================
// 14. DATA MODIFIERS (SAVE, ADD, REMOVE)
// ==========================================
function saveSemesterDates() {
  const sDate = document.getElementById('semStartInput').value;
  const eDate = document.getElementById('semEndInput').value;
  if(!sDate || !eDate) return alert('Select both start and end dates.');
  
  if(!academicCalendar) academicCalendar = {};
  academicCalendar.startDate = sDate;
  academicCalendar.endDate = eDate;
  saveToDatabase();
  forceCloseModal();
  renderUI();
  alert('Semester dates saved successfully!');
}

function handleAddCourse() {
  const name = document.getElementById('newCourseName').value.trim();
  const code = document.getElementById('newCourseCode').value.trim();
  const day = document.getElementById('newCourseDay').value;
  const start = document.getElementById('newCourseStart').value;
  const end = document.getElementById('newCourseEnd').value;
  if (!name) return alert("Enter course name.");

  let schedule = {};
  if (start && end) schedule[day] = [{ start, end }];
  courses.push({ id: Date.now(), name, code: code || 'CUSTOM', present: 0, absent: 0, schedule });
  saveToDatabase();
  forceCloseModal();
  renderUI();
}

function saveTargetPercentage() {
  const val = parseInt(document.getElementById('targetInput').value, 10);
  if (!val || val < 1 || val > 100) return alert("Enter valid % between 1 and 100.");
  targetPercentage = val;
  localStorage.setItem('target_percentage', val);
  forceCloseModal();
  renderUI();
}

function resetToDefaultTimetable() {
  if (confirm(`Reset all records and timetable for ${currentSemester}?`)) {
    courses = [];
    markedDates = [];
    saveToDatabase();
    renderUI();
    closeSettingsPage();
  }
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
  forceCloseModal();
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

// ==========================================
// 15. TIMETABLE INLINE EDITING
// ==========================================
function toggleTimetableEdit() {
  if (isEditingTimetable) {
    saveInlineTimetable();
  } else {
    isEditingTimetable = true;
    inlineEditSchedule = [];
    courses.forEach(c => {
      if (c.schedule && c.schedule[currentSelectedDay]) {
        c.schedule[currentSelectedDay].forEach(slot => {
          inlineEditSchedule.push({ start: slot.start, end: slot.end, name: c.name });
        });
      }
    });
    inlineEditSchedule.sort((a,b) => a.start.localeCompare(b.start));
    renderUI();
  }
}

function saveInlineTimetable() {
  for (let p of inlineEditSchedule) {
    if(!p.start || !p.end || !p.name.trim()) return alert("Fill all course names and times before saving.");
    if(p.start >= p.end) return alert("Start time must be before end time for " + (p.name || 'period') + ".");
  }

  courses.forEach(c => {
    if (c.schedule && c.schedule[currentSelectedDay]) {
      delete c.schedule[currentSelectedDay];
    }
  });
  
  inlineEditSchedule.forEach(p => {
    let course = courses.find(c => c.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    if (!course) {
      course = { id: Date.now() + Math.random(), name: p.name.trim(), code: 'CUSTOM', present: 0, absent: 0, schedule: {} };
      courses.push(course);
    }
    if (!course.schedule) course.schedule = {};
    if (!course.schedule[currentSelectedDay]) course.schedule[currentSelectedDay] = [];
    course.schedule[currentSelectedDay].push({ start: p.start, end: p.end });
  });

  addHistory(`Updated timetable for ${currentSelectedDay}`);
  saveToDatabase();
  isEditingTimetable = false;
  renderUI();
}

function addInlinePeriod() {
  inlineEditSchedule.push({ start: '09:00', end: '10:00', name: '' });
  renderUI();
}

function updateInlinePeriod(index, field, value) {
  inlineEditSchedule[index][field] = value;
}

function removeInlinePeriod(index) {
  inlineEditSchedule.splice(index, 1);
  renderUI();
}

function changeDay(dayName) { 
  currentSelectedDay = dayName; 
  isEditingTimetable = false;
  renderUI(); 
}

// ==========================================
// 16. INTERACTIVE CLOCK PICKER
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
  if (!isPaywallShowing && !document.getElementById('settingsPage').classList.contains('open')) {
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
// 17. ACADEMIC CALENDAR SETUP
// ==========================================
let setupBlobUrl = null;
let setupTempData = {};
let setupStartDate = null;
let setupEndDate = null;

function startCalendarSetup() {
  const fileInput = document.getElementById('calFileInput');
  setupStartDate = document.getElementById('termStart').value;
  setupEndDate = document.getElementById('termEnd').value;

  if (!setupStartDate || !setupEndDate) {
    return alert("Please select both start and end dates to set up the calendar.");
  }
  if (new Date(setupStartDate) > new Date(setupEndDate)) {
    return alert("Start date cannot be after the end date.");
  }

  const previewWrapper = document.getElementById('previewWrapper');
  
  if (fileInput.files && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    setupBlobUrl = URL.createObjectURL(file);
    const isImage = file.type.match(/image/i) || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i);
    
    if (isImage) {
      previewWrapper.innerHTML = `<img id="setupImagePreview" src="${setupBlobUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:contain;" alt="Calendar Preview" />`;
    } else {
      previewWrapper.innerHTML = `<iframe src="${setupBlobUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; background:white;"></iframe>`;
    }
  } else {
    previewWrapper.innerHTML = `
      <div style="color:var(--text-sub); text-align:center; padding:20px; font-weight:800;">
        <span style="font-size:2rem; display:block; margin-bottom:10px;">📅</span>
        No reference document uploaded.<br><br>You can still map holidays and important dates below.
      </div>`;
  }
  
  setupTempData = {}; 
  if (academicCalendar) {
    if (academicCalendar.holidays) academicCalendar.holidays.forEach(d => setupTempData[d] = 'holiday');
    if (academicCalendar.importantDates) academicCalendar.importantDates.forEach(d => setupTempData[d] = 'important');
  }

  buildSetupCalendar(setupStartDate, setupEndDate);
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
  document.body.classList.remove('scroll-locked');
  const previewWrapper = document.getElementById('previewWrapper');
  if (previewWrapper) previewWrapper.innerHTML = '';
  if (setupBlobUrl) {
    URL.revokeObjectURL(setupBlobUrl);
    setupBlobUrl = null;
  }
}

// ==========================================
// 18. TIMETABLE SHARING & IMPORTING
// ==========================================
async function openShareTimetableModal() {
  if (courses.length === 0) return alert("You don't have any courses to share.");

  const shareCode = 'TT-' + Math.floor(1000 + Math.random() * 9000);
  const sharePayload = {
    code: shareCode,
    semester: currentSemester,
    creatorName: currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : "Classmate",
    createdAt: new Date().toISOString(),
    courses: courses.map(c => ({ name: c.name, code: c.code || 'CUSTOM', schedule: c.schedule || {} }))
  };

  try {
    if (db) {
      await db.collection('shared_timetables').doc(shareCode).set(sharePayload);
    } else {
      localStorage.setItem(`share_${shareCode}`, JSON.stringify(sharePayload));
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?timetable=${shareCode}`;
    openModal('shareModal', {code: shareCode, url: shareUrl}); 
  } catch (err) {
    alert("Could not generate share code: " + err.message);
  }
}

function openImportTimetableModal(presetCode = '') {
  openModal('importModal', presetCode);
}

async function fetchAndPreviewTimetable() {
  const codeInput = document.getElementById('importCodeInput');
  const statusMsg = document.getElementById('importStatusMsg');
  const previewArea = document.getElementById('importPreviewArea');
  const code = (codeInput.value || '').trim().toUpperCase();

  if (!code) {
    statusMsg.innerText = "Please enter a valid code.";
    return;
  }

  statusMsg.style.color = '#3498db';
  statusMsg.innerText = "Fetching schedule from cloud...";
  previewArea.innerHTML = '';

  try {
    let timetableData = null;

    if (db) {
      const doc = await db.collection('shared_timetables').doc(code).get();
      if (doc.exists) {
        timetableData = doc.data();
      }
    }

    if (!timetableData) {
      const local = localStorage.getItem(`share_${code}`);
      if (local) timetableData = JSON.parse(local);
    }

    if (!timetableData || !timetableData.courses || timetableData.courses.length === 0) {
      statusMsg.style.color = 'var(--absent-btn)';
      statusMsg.innerText = "Invalid code or timetable no longer exists.";
      return;
    }

    statusMsg.style.color = 'var(--present-btn)';
    statusMsg.innerText = `✓ Timetable found from ${timetableData.creatorName || 'Classmate'}!`;

    let coursesListHtml = '';
    timetableData.courses.forEach(c => {
      let slotCount = 0;
      Object.keys(c.schedule || {}).forEach(d => slotCount += c.schedule[d].length);
      coursesListHtml += `
        <div class="import-preview-item">
          <div><b>${c.name}</b> <span style="color:var(--text-sub);">(${c.code || 'CUSTOM'})</span></div>
          <span style="font-weight:800; color:#3498db;">${slotCount} classes/wk</span>
        </div>
      `;
    });

    window._pendingImportTimetable = timetableData;

    previewArea.innerHTML = `
      <div style="margin-top:14px;">
        <label style="font-size:0.8rem; font-weight:800; color:var(--text-main);">Courses Preview (${timetableData.courses.length} courses):</label>
        <div class="import-preview-list">
          ${coursesListHtml}
        </div>

        <div style="display:flex; gap:10px; margin-top:14px;">
          <button class="vpopup-btn vpopup-btn-cancel funky-button" style="background:var(--card-bg); color:var(--text-main);" onclick="applyImportedTimetable('merge')">
            ➕ Merge
          </button>
          <button class="vpopup-btn vpopup-btn-confirm funky-button" style="background:var(--present-btn); color:white;" onclick="applyImportedTimetable('replace')">
            🔄 Replace All
          </button>
        </div>
      </div>
    `;

  } catch (err) {
    statusMsg.style.color = 'var(--absent-btn)';
    statusMsg.innerText = "Fetch error: " + err.message;
  }
}

function applyImportedTimetable(mode) {
  const data = window._pendingImportTimetable;
  if (!data || !data.courses) return;

  if (mode === 'replace') {
    courses = data.courses.map(c => ({
      id: Date.now() + Math.random(),
      name: c.name,
      code: c.code || 'CUSTOM',
      present: 0,
      absent: 0,
      schedule: c.schedule || {}
    }));
  } else {
    data.courses.forEach(newC => {
      const existing = courses.find(c => c.name.trim().toLowerCase() === newC.name.trim().toLowerCase());
      if (existing) {
        existing.schedule = newC.schedule || {};
      } else {
        courses.push({
          id: Date.now() + Math.random(),
          name: newC.name,
          code: newC.code || 'CUSTOM',
          present: 0,
          absent: 0,
          schedule: newC.schedule || {}
        });
      }
    });
  }

  addHistory(`Imported timetable via code ${data.code} (${mode} mode)`);
  saveToDatabase();
  forceCloseModal();
  renderUI();

  showVirtualPopup({
    icon: '🎉',
    title: 'Timetable Loaded!',
    message: `Successfully loaded <b>${data.courses.length} courses</b> into your schedule for <b>${currentSemester}</b>.`,
    confirmText: 'View Schedule',
    cancelText: '',
    onConfirm: () => switchTab('timetable')
  });
}

// ==========================================
// 19. AUTHENTICATION HANDLERS
// ==========================================
function switchAuthMode(mode) {
  authMode = mode;
  openModal('authModal');
}

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
      if (confirm("Account not found. Create a new account with this email?")) {
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
    alert("Signed out. Operating in offline mode.");
  } catch (error) {
    alert(error.message);
  }
}

// ==========================================
// 20. AUTOMATED CHECKOUT SYSTEM
// ==========================================
async function initiatePayment() {
  if (!currentUser) {
    alert("Please sign in with your email first so your semester pass can be linked to your account.");
    openModal('authModal');
    return;
  }

  const orderRefId = 'AT' + Math.floor(1000 + Math.random() * 9000);
  const upiId = "8073510268@fam";
  const payeeName = "Attendance Tracker";
  const amountVal = Math.round(subscriptionPrice || 20);

  const queryParams = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amountVal}&cu=INR&tn=${encodeURIComponent(orderRefId)}&tr=${encodeURIComponent(orderRefId)}`;
  
  const upiUrl = `upi://pay?${queryParams}`;
  const gpayUrl = `intent://pay?${queryParams}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
  const phonePeUrl = `phonepe://pay?${queryParams}`;
  const paytmUrl = `paytmmp://pay?${queryParams}`;
  const bhimUrl = `bhim://pay?${queryParams}`;
  const credUrl = `credpay://upi/pay?${queryParams}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;

  if (db) {
    try {
      await db.collection('payment_orders').doc(orderRefId).set({
        orderId: orderRefId,
        uid: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName || 'Student',
        amount: amountVal,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn("Firestore order log error:", e);
    }
  }

  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.className = 'modal-content checkout-card';
  modalOverlay.classList.add('active');
  document.body.classList.add('scroll-locked');

  modalContent.innerHTML = `
    <div class="checkout-top-bar">
      <div class="checkout-merchant-info">
        <div class="checkout-merchant-icon">🛡️</div>
        <div>
          <div class="checkout-merchant-name">Attendance Tracker <span class="badge-verified-pill">VERIFIED</span></div>
          <div class="checkout-merchant-item">Order Ref: <b style="color:#38bdf8; letter-spacing:1px;">${orderRefId}</b></div>
        </div>
      </div>
      <div class="checkout-top-right">
        <div class="checkout-price-box">
          <div class="checkout-price-label">AMOUNT DUE</div>
          <div class="checkout-price-value">₹${amountVal}</div>
        </div>
        <button type="button" class="checkout-close-btn" onclick="forceCloseModal()">×</button>
      </div>
    </div>
    <div class="checkout-trust-strip">
      <span>🔒 256-Bit Encrypted Transfer</span>
      <span>⚡ Instant Cloud Activation</span>
    </div>
    <div class="checkout-body">
      <a href="${upiUrl}" class="btn-checkout-upi-app">📲 Pay ₹${amountVal} via Any UPI App</a>
      <div class="checkout-brand-icons-row">
        <a href="${gpayUrl}" class="brand-icon-card" title="Google Pay"><img src="gpay_icon.jfif" alt="Google Pay" onerror="this.onerror=null; this.src='https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg';" /></a>
        <a href="${phonePeUrl}" class="brand-icon-card" title="PhonePe"><img src="phonepe_icon.jfif" alt="PhonePe" onerror="this.onerror=null; this.src='https://download.logo.wine/logo/PhonePe/PhonePe-Logo.wine.png';" /></a>
        <a href="${paytmUrl}" class="brand-icon-card" title="Paytm"><img src="paytm_icon.png" alt="Paytm" onerror="this.onerror=null; this.src='https://asset.brandfetch.io/id_j8vV11K/id_o5V51w_.png';" /></a>
        <a href="${bhimUrl}" class="brand-icon-card" title="BHIM UPI"><img src="bhim_icon.jfif" alt="BHIM UPI" onerror="this.onerror=null; this.src='https://upload.wikimedia.org/wikipedia/commons/e/e1/BHIM_logo.svg';" /></a>
        <a href="${credUrl}" class="brand-icon-card" title="CRED"><img src="cred_icon.png" alt="CRED" onerror="this.onerror=null; this.src='https://web-images.credcdn.in/_next/assets/images/home-page/cred-logo.png';" /></a>
      </div>
      <div class="checkout-qr-frame">
        <img src="${qrUrl}" alt="UPI QR" class="checkout-qr-img" />
        <div class="checkout-copy-row">
          <span class="checkout-upi-text" id="upiVpaText">${upiId}</span>
          <button type="button" class="btn-copy-upi" onclick="copyUpiVpa('${upiId}', true)">📋 Copy</button>
        </div>
      </div>
      <div id="checkoutStatusArea" class="checkout-radar-box">
        <div class="radar-ping-dot"></div>
        <div class="radar-text-title">Waiting for payment confirmation...</div>
        <div class="radar-text-sub">Keep this page open. Your account unlocks automatically within seconds once your transfer completes.</div>
      </div>
    </div>
  `;

  if (activeOrderUnsubscribe) {
    activeOrderUnsubscribe();
    activeOrderUnsubscribe = null;
  }

  if (db) {
    activeOrderUnsubscribe = db.collection('payment_orders').doc(orderRefId).onSnapshot(doc => {
      if (doc.exists && doc.data().status === 'approved') {
        if (activeOrderUnsubscribe) { 
          activeOrderUnsubscribe(); 
          activeOrderUnsubscribe = null; 
        }
        const statusArea = document.getElementById('checkoutStatusArea');
        if (statusArea) {
          statusArea.classList.add('approved');
          statusArea.innerHTML = `<div style="font-size:1.15rem; font-weight:900; color:var(--present-btn);">✓ Payment Confirmed!</div><div style="font-size:0.8rem; color:var(--text-sub); margin-top:4px;">Activating Lifetime Pass...</div>`;
        }
        setTimeout(() => {
          forceCloseModal();
          showVirtualPopup({ icon: '🎉', title: 'Welcome to Pro!', message: 'Your payment was automatically confirmed. Lifetime semester access is unlocked!', confirmText: 'Get Started', cancelText: '', onConfirm: () => {} });
        }, 1200);
      }
    });
  }
}

async function openAdminVerifyModal() {
  const modalContent = document.getElementById('modalContent');
  modalContent.className = 'modal-content';
  modalContent.innerHTML = `
    <button class="close-btn" onclick="forceCloseModal()">×</button>
    <h2>Pending Orders</h2>
    <p style="font-size:0.85rem; color:var(--text-sub); margin-bottom:15px;">Live payment orders generated by students:</p>
    <div id="adminRequestsList" style="max-height: 50vh; overflow-y:auto;">Loading orders...</div>
  `;

  try {
    if (!db) throw new Error("Firestore not initialized.");
    const snapshot = await db.collection('payment_orders').where('status', '==', 'pending').get();
    const listEl = document.getElementById('adminRequestsList');
    if (snapshot.empty) {
      listEl.innerHTML = `<p style="color:var(--text-sub); text-align:center; padding: 25px 0;">No pending orders awaiting verification.</p>`;
      return;
    }

    let html = '';
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      html += `
        <div style="background:var(--bg-color); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:10px; text-align:left;">
          <div style="font-weight:800; font-size:0.95rem; color:var(--text-main);">${data.email}</div>
          <div style="font-size:0.8rem; color:var(--text-sub); margin: 3px 0;">Order Code: <b style="letter-spacing:1px; color:#3498db;">${data.orderId || docSnap.id}</b> (₹${data.amount || subscriptionPrice})</div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="vpopup-btn vpopup-btn-confirm" style="padding:6px 12px; font-size:0.8rem;" onclick="adminApproveOrder('${docSnap.id}', '${data.uid}')">✓ Approve</button>
            <button class="vpopup-btn vpopup-btn-cancel" style="padding:6px 12px; font-size:0.8rem;" onclick="adminRejectOrder('${docSnap.id}')">✖ Reject</button>
          </div>
        </div>
      `;
    });
    listEl.innerHTML = html;
  } catch (err) {
    document.getElementById('adminRequestsList').innerHTML = `<p style="color:var(--absent-btn); font-size:0.85rem;">Error loading: ${err.message}</p>`;
  }
}

async function adminApproveOrder(orderId, studentUid) {
  try {
    await db.collection('payment_orders').doc(orderId).update({ status: 'approved', approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('users').doc(studentUid).set({ isPro: true, role: 'pro', unlockedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    alert(`Order ${orderId} approved! Student account unlocked.`);
    openAdminVerifyModal();
  } catch (err) { 
    alert("Approval failed: " + err.message); 
  }
}

async function adminRejectOrder(orderId) {
  if (!confirm(`Reject order ${orderId}?`)) return;
  try {
    await db.collection('payment_orders').doc(orderId).update({ status: 'rejected', rejectedAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Order marked rejected.");
    openAdminVerifyModal();
  } catch (err) { 
    alert("Rejection failed: " + err.message); 
  }
}

// ==========================================
// 21. APP STARTUP
// ==========================================
function startLiveClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  const updateClock = () => {
    const now = new Date();
    el.innerHTML = `
      <div class="clock-time">${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
      <div class="clock-date">${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
    `;
  };
  updateClock(); 
  setInterval(updateClock, 1000);
}

startLiveClock();
renderUI();
setInterval(checkClassStartNotifications, 60000);

window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('timetable');
  if (code) {
    setTimeout(() => openImportTimetableModal(code), 600);
  }
  
  if (!localStorage.getItem(MANUAL_SHOWN_KEY)) { 
    localStorage.setItem(MANUAL_SHOWN_KEY, 'true'); 
    setTimeout(() => openModal('userManual'), 300);
  }
});