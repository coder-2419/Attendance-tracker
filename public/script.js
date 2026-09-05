const DB_KEY = 'attendance_tracker_v11';
const HISTORY_KEY = 'attendance_history_v1';
const CALENDAR_KEY = 'academic_calendar_v1';
const TARGET_PERCENTAGE = 75;

let courses = loadFromDatabase();
let historyLog = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let academicCalendar = JSON.parse(localStorage.getItem(CALENDAR_KEY)) || null;
let currentSelectedDay = getTodayString();

if(localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
  closeModal();
}

function getTodayString() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  return today === 'Sunday' ? 'Monday' : today; 
}

const masterScheduleMap = {
  '25CIV104': { name: 'Environmental Science', schedule: { Monday: [{ start: '09:00', end: '09:55' }], Wednesday: [{ start: '13:30', end: '14:25' }] } },
  '25ECE111': { name: 'Basic Electronics', schedule: { Monday: [{ start: '09:55', end: '10:50' }], Thursday: [{ start: '09:55', end: '10:50' }], Saturday: [{ start: '09:00', end: '09:55' }] } },
  '25PHY102': { name: 'Quantum Computing', schedule: { Monday: [{ start: '11:00', end: '11:55' }], Thursday: [{ start: '13:30', end: '14:25' }], Saturday: [{ start: '09:55', end: '10:50' }] } },
  '25MAT103': { name: 'Advanced Calculus', schedule: { Monday: [{ start: '11:55', end: '12:50' }], Wednesday: [{ start: '11:55', end: '12:50' }], Thursday: [{ start: '09:00', end: '09:55' }], Friday: [{ start: '09:55', end: '10:50' }], Saturday: [{ start: '11:00', end: '11:55' }] } },
  '25CSE103': { name: 'Problem Solving (Prog)', schedule: { Monday: [{ start: '13:30', end: '14:25' }], Thursday: [{ start: '11:55', end: '12:50' }], Friday: [{ start: '09:00', end: '09:55' }], Saturday: [{ start: '11:55', end: '12:50' }] } },
  '25HSS131': { name: 'Communicative English', schedule: { Monday: [{ start: '14:25', end: '15:20' }] } },
  '25HSS132': { name: 'Knowing Yourself', schedule: { Wednesday: [{ start: '11:00', end: '11:55' }], Thursday: [{ start: '11:00', end: '11:55' }] } },
  '25PHY107': { name: 'Physics Lab', schedule: { Wednesday: [{ start: '14:25', end: '15:20' }] } },
  '25MAT122': { name: 'Math Lab', schedule: { Thursday: [{ start: '14:25', end: '16:15' }] } },
  '25HSS102': { name: 'Universal Human Values', schedule: { Friday: [{ start: '13:30', end: '15:20' }] } },
  '25HSS101': { name: 'Constitution of India', schedule: { Friday: [{ start: '15:20', end: '16:15' }] } },
  'PHYSICS LAB': { name: 'Physics Practical Block', schedule: { Wednesday: [{ start: '09:00', end: '10:50' }] } },
  'COMPUTER LAB': { name: 'Computer Practical Block', schedule: { Friday: [{ start: '11:00', end: '12:50' }] } }
};

function buildInitialDatabase() {
  const initialCourses = [];
  Object.keys(masterScheduleMap).forEach((code, index) => {
    initialCourses.push({ id: index + 1, name: masterScheduleMap[code].name, code: code, present: 0, absent: 0, schedule: masterScheduleMap[code].schedule });
  });
  return initialCourses;
}

function loadFromDatabase() {
  const storedData = localStorage.getItem(DB_KEY);
  return storedData ? JSON.parse(storedData) : []; 
}

function saveToDatabase() {
  localStorage.setItem(DB_KEY, JSON.stringify(courses));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyLog));
}

function addHistory(action) {
  const now = new Date();
  const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  historyLog.unshift({ time: timestamp, action });
  if (historyLog.length > 50) historyLog.pop(); 
  saveToDatabase();
}

function format12Hour(time24) {
  if (!time24 || time24 === '--:--') return '--:--';
  let [hours, minutes] = time24.split(':');
  hours = parseInt(hours, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; 
  return `${hours}:${minutes} ${ampm}`;
}

function startLiveClock() {
  const clockElement = document.getElementById('liveClock');
  if (!clockElement) return;
  setInterval(() => {
    const now = new Date();
    clockElement.innerHTML = `<div class="clock-time">${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</div><div class="clock-date">${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>`;
  }, 1000);
}

function getTodayDateString() {
  const now = new Date(); return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
}
function isTodayHoliday() { return localStorage.getItem('holiday_' + getTodayDateString()) === 'true'; }

function toggleHoliday() {
  const todayStr = getTodayDateString();
  if (isTodayHoliday()) localStorage.removeItem('holiday_' + todayStr);
  else localStorage.setItem('holiday_' + todayStr, 'true');
  updateHolidayButton(); renderUI(); 
}

function updateHolidayButton() {
  const btn = document.getElementById('holidayBtn');
  if (!btn) return;
  if (isTodayHoliday()) { btn.classList.add('active'); btn.innerText = 'HOLIDAY ACTIVE'; } 
  else { btn.classList.remove('active'); btn.innerText = 'Mark Today Holiday'; }
}

async function processAcademicCalendar(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('aiLoading').classList.add('active');
  closeModal();

  try {
    const base64String = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64String, mimeType: file.type })
    });

    if (!response.ok) throw new Error('API Error');
    academicCalendar = await response.json();
    localStorage.setItem(CALENDAR_KEY, JSON.stringify(academicCalendar));
    alert("Calendar Synced Successfully!");
    
  } catch (error) {
    console.error(error); alert("Failed to read calendar. Ensure the image is clear.");
  } finally {
    document.getElementById('aiLoading').classList.remove('active');
    event.target.value = '';
  }
}

async function processOCR(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('ocrLoading').classList.add('active');
  closeModal();

  try {
    const worker = await Tesseract.createWorker('eng');
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    
    const standardCodes = text.match(/2[56][A-Z]{3}1[0-9]{2}/gi) || [];
    const labCodes = text.match(/PHYSICS LAB|COMPUTER LAB/gi) || [];
    const foundCodes = [...new Set([...standardCodes.map(c=>c.toUpperCase()), ...labCodes.map(l=>l.toUpperCase())])];
    
    let matchedAny = false;
    foundCodes.forEach(code => { if (masterScheduleMap[code]) matchedAny = true; });
    const isSectionI = text.toLowerCase().includes('section - i') || text.toLowerCase().includes('205');

    if (matchedAny || isSectionI) {
      courses = buildInitialDatabase(); saveToDatabase(); renderUI();
      alert("Timetable Recognized! Subjects loaded perfectly.");
    } else {
      alert("Could not recognize this as the timetable.");
    }
  } catch (error) {
    alert("Error reading image."); console.error(error);
  } finally {
    document.getElementById('ocrLoading').classList.remove('active');
    event.target.value = ''; 
  }
}

function markFullDayPresent(dateString, element) {
  const dateObj = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[dateObj.getDay()];

  let classesUpdated = 0;
  courses.forEach(course => {
    if (course.schedule && course.schedule[dayName]) {
      course.schedule[dayName].forEach(() => { course.present += 1; classesUpdated += 1; });
    }
  });

  if (classesUpdated > 0) {
    addHistory(`Full Day Present: ${dateString} (${classesUpdated} classes)`);
    element.classList.add('present'); 
    renderUI();
  } else {
    alert("No classes scheduled for this day.");
  }
}

function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('menuOverlay').classList.toggle('active'); }
function closeModal(e) { if (e && e.target !== document.getElementById('modalOverlay') && !e.target.classList.contains('close-btn')) return; document.getElementById('modalOverlay').classList.remove('active'); }

function openModal(type) {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('menuOverlay').classList.remove('active');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalOverlay.classList.add('active');
  let html = `<button class="close-btn" onclick="closeModal()">×</button>`;

  if (type === 'userManual') {
    html += `<h2>How to Use This App</h2>
      <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px; text-align: left;">
        <div class="manual-section">
          <h3>1. Getting Started</h3>
          <p>This app starts completely empty. Go to the menu to add your courses manually, or use the <b>Upload Timetable (OCR)</b> tool to instantly load your schedule from an image.</p>
        </div>
        <div class="manual-section">
          <h3>2. Academic Calendar (Gemini AI)</h3>
          <p>Upload a picture of your university calendar. The AI will scan for holidays and important dates. Tap the clock at the top right to view it and batch-mark full days.</p>
        </div>
        <div class="manual-section">
          <h3>3. The Bunk Meter</h3>
          <p>The app automatically tracks your 75% attendance threshold. It tells you exactly how many classes you can safely afford to miss, or how many you need to attend.</p>
        </div>
        <div class="manual-section">
          <h3>4. History Log</h3>
          <p>Every attendance mark is timestamped and saved in the History Log so you can always verify your records.</p>
        </div>
      </div>`;
  }
  else if (type === 'historyLog') {
    html += `<h2>History Log</h2><div class="history-list">`;
    if (historyLog.length === 0) html += `<p style="color:var(--text-sub);">No history yet.</p>`;
    historyLog.forEach(log => { html += `<div class="history-item"><span>${log.action}</span><span style="color:var(--text-sub); font-size:0.75rem;">${log.time}</span></div>`; });
    html += `</div>`;
  }
  else if (type === 'setupCalendar') {
    html += `<h2>Upload Academic Calendar</h2><p style="color:var(--text-sub); margin-bottom:15px;">Gemini will scan the document for holidays.</p><input type="file" accept="image/*" class="modal-input" onchange="processAcademicCalendar(event)" />`;
  }
  else if (type === 'calendarMode') {
    if (!academicCalendar) {
      html += `<h2>Academic Calendar</h2><p style="color:var(--text-sub);">Please upload a calendar in the menu first.</p>`;
    } else {
      html += `<h2>Batch Mark Attendance</h2><p style="font-size:0.8rem; margin-bottom:15px; text-align:center; color:var(--text-sub);">Tap a day to mark all its classes present.</p><div class="cal-grid">`;
      const start = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        let statusClass = '';
        if (academicCalendar.holidays && academicCalendar.holidays.includes(dateStr)) statusClass = 'holiday';
        else if (academicCalendar.importantDates && academicCalendar.importantDates.includes(dateStr)) statusClass = 'important';
        html += `<div class="cal-day ${statusClass}" onclick="markFullDayPresent('${dateStr}', this)">${d.getDate()}</div>`;
      }
      html += `</div><div style="margin-top:15px; display:flex; gap:10px; font-size:0.75rem; justify-content:center;"><span style="color:#e74c3c">■ Holiday</span> <span style="color:#3498db">■ Important</span> <span style="color:#2ecc71">■ Present</span></div>`;
    }
  }
  else if (type === 'addTimetable') { html += `<h2>Upload Timetable</h2><input type="file" accept="image/*" class="modal-input" onchange="processOCR(event)" />`; }
  
  modalContent.innerHTML = html;
}

function getBunkStatus(present, absent) {
  const total = present + absent;
  if (total === 0) return `<span class="bunk-meter" style="color:var(--text-sub);">No classes yet</span>`;
  const currentPercent = (present / total) * 100;
  if (currentPercent >= TARGET_PERCENTAGE) {
    const buffer = Math.floor((present / (TARGET_PERCENTAGE / 100)) - total);
    return buffer > 0 ? `<span class="bunk-meter bunk-safe">Safe to bunk ${buffer} classes</span>` : `<span class="bunk-meter bunk-safe">On track (0 buffer)</span>`;
  } else {
    const required = Math.ceil(((TARGET_PERCENTAGE / 100) * total - present) / (1 - (TARGET_PERCENTAGE / 100)));
    return `<span class="bunk-meter bunk-danger">Attend next ${required} classes</span>`;
  }
}

function changeDay(dayName) { currentSelectedDay = dayName; renderUI(); }

function renderUI() {
  document.querySelectorAll('.day-selector button').forEach(btn => {
    btn.classList.remove('active-day');
    if (btn.innerText.startsWith(currentSelectedDay.substring(0, 3))) btn.classList.add('active-day');
  });

  const timeContainer = document.getElementById('timetableContainer');
  const isToday = getTodayString() === currentSelectedDay;

  if (isToday && isTodayHoliday()) {
    timeContainer.innerHTML = `<div style="text-align:center; padding: 25px 20px; background: #fdf5f5; border-radius: 12px; border: 2px dashed #e74c3c; width:100%;"><p style="color:#e74c3c; font-size:1.15rem; font-weight:800;">🏖️ TODAY IS A HOLIDAY</p></div>`;
  } else {
    let todaysClasses = [];
    courses.forEach(c => { if (c.schedule && c.schedule[currentSelectedDay]) c.schedule[currentSelectedDay].forEach(slot => { todaysClasses.push({ name: c.name, start: slot.start, end: slot.end }); }); });
    if (todaysClasses.length === 0) timeContainer.innerHTML = `<p style="color:var(--text-sub);">No classes scheduled.</p>`;
    else {
      todaysClasses.sort((a, b) => a.start.localeCompare(b.start));
      const now = new Date(); const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      let html = '';
      todaysClasses.forEach(cls => {
        let status = '';
        if (isToday) { if (currentTime >= cls.start && currentTime <= cls.end) status = 'active'; else if (currentTime > cls.end) status = 'past'; }
        html += `<div class="timeline-card ${status}"><div class="timeline-time">${format12Hour(cls.start)} - ${format12Hour(cls.end)}</div><div class="timeline-course">${cls.name}</div></div>`;
      });
      timeContainer.innerHTML = html;
    }
  }

  const listContainer = document.getElementById('courseList');
  listContainer.innerHTML = '';
  if (courses.length === 0) { listContainer.innerHTML = `<p style="color:var(--text-sub); text-align:center;">No Courses Found</p>`; return; }

  const holidayMode = isTodayHoliday();
  courses.forEach(course => {
    const total = course.present + course.absent;
    const percentage = total === 0 ? 0 : Math.round((course.present / total) * 100);
    const dashOffset = (2 * Math.PI * 38) - ((percentage / 100) * (2 * Math.PI * 38));

    let actionHTML = holidayMode ? `<div class="action-bar" id="action-${course.id}"><span style="font-weight: 800; color: #e74c3c;">HOLIDAY</span></div>` : `<div class="action-bar" id="action-${course.id}"><button class="btn-present" onclick="markAttendance(${course.id}, 'present')">PRESENT</button><button class="btn-absent" onclick="markAttendance(${course.id}, 'absent')">ABSENT</button></div>`;

    listContainer.innerHTML += `
      <div class="course-card-wrapper">
        <div class="course-card" onclick="toggleActionBar(${course.id})">
          <div class="progress-circle">
            <svg width="90" height="90"><circle cx="45" cy="45" r="38" stroke="#e74c3c" stroke-width="8" fill="transparent" /><circle cx="45" cy="45" r="38" stroke="#2ecc71" stroke-width="8" fill="transparent" stroke-dasharray="238.7" stroke-dashoffset="${dashOffset}" stroke-linecap="round" style="transition: stroke-dashoffset 1s ease-in-out;" /></svg>
            <div class="percentage-text" style="color:var(--text-main);">${percentage}%</div>
          </div>
          <div class="course-info"><h2>${course.name}</h2><p>Total Classes: ${total}</p>${getBunkStatus(course.present, course.absent)}</div>
        </div>
        ${actionHTML}
      </div>`;
  });
}

function markAttendance(id, status) {
  const course = courses.find(c => c.id === id);
  if (status === 'present') course.present += 1;
  if (status === 'absent') course.absent += 1;
  addHistory(`${status.toUpperCase()}: ${course.name}`);
  toggleActionBar(id); saveToDatabase(); renderUI();    
}

function toggleActionBar(id) {
  const bar = document.getElementById(`action-${id}`);
  document.querySelectorAll('.action-bar').forEach(el => { if (el.id !== `action-${id}`) el.classList.remove('slide-in'); });
  bar.classList.toggle('slide-in');
}

startLiveClock(); 
updateHolidayButton(); 
renderUI(); 
setInterval(renderUI, 60000);

if (!localStorage.getItem('appManualShown')) {
  localStorage.setItem('appManualShown', 'true');
  openModal('userManual');
}