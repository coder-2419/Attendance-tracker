const DB_KEY = 'attendance_tracker_v12';
const HISTORY_KEY = 'attendance_history_v2';
const CALENDAR_KEY = 'academic_calendar_v2';

let targetPercentage = parseInt(localStorage.getItem('target_percentage')) || 75;
let courses = loadFromDatabase();
let historyLog = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let academicCalendar = JSON.parse(localStorage.getItem(CALENDAR_KEY)) || null;
let currentSelectedDay = getTodayString();

if(localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
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
    initialCourses.push({ id: Date.now() + index, name: masterScheduleMap[code].name, code: code, present: 0, absent: 0, schedule: masterScheduleMap[code].schedule });
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
  const now = new Date(); return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
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

// ---- NEW MANUAL CALENDAR LOAD INSTEAD OF AI ----
function loadNMITCalendar() {
  academicCalendar = {
    startDate: "2026-08-03",
    endDate: "2026-11-30",
    holidays: [
      "2026-08-15", "2026-08-17", "2026-09-14", "2026-10-02", 
      "2026-10-21", "2026-11-09", "2026-11-10", "2026-12-25", "2026-12-26"
    ],
    importantDates: [
      "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12",
      "2026-09-26", "2026-10-09",
      "2026-10-31", "2026-11-02", "2026-11-03", "2026-11-04"
    ]
  };
  localStorage.setItem(CALENDAR_KEY, JSON.stringify(academicCalendar));
  renderUI();
  closeModal();
  alert("NMIT Odd Semester (2026-27) Calendar successfully synced!");
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
    } else { alert("Could not recognize this as the timetable."); }
  } catch (error) { alert("Error reading image."); console.error(error);
  } finally { document.getElementById('ocrLoading').classList.remove('active'); event.target.value = ''; }
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
    element.classList.add('present'); renderUI();
  } else { alert("No classes scheduled for this day."); }
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
    html += `<h2>How to Use This App</h2><div style="max-height: 60vh; overflow-y: auto; padding-right: 10px; text-align: left;">
      <div class="manual-section"><h3>1. Getting Started</h3><p>App starts empty. Go to the menu to add courses manually, or use the <b>Upload Timetable (OCR)</b> tool.</p></div>
      <div class="manual-section"><h3>2. Academic Calendar</h3><p>Use the Sync option in the menu to load your semester dates. Tap the top-right clock to batch-mark full days.</p></div>
      <div class="manual-section"><h3>3. The Bunk Meter</h3><p>The app tracks your configured threshold, telling you if you can bunk safely or need to attend.</p></div>
    </div>`;
  } else if (type === 'historyLog') {
    html += `<h2>History Log</h2><div class="history-list">`;
    if (historyLog.length === 0) html += `<p style="color:var(--text-sub);">No history yet.</p>`;
    historyLog.forEach(log => { html += `<div class="history-item"><span>${log.action}</span><span style="color:var(--text-sub); font-size:0.75rem;">${log.time}</span></div>`; });
    html += `</div>`;
  } else if (type === 'setupCalendar') {
    html += `<h2>Sync Academic Calendar</h2>
      <p style="color:var(--text-sub); margin-bottom: 20px; font-size:0.9rem;">Load the official NMIT Odd Semester (2026-27) holiday and MSE dates into your app locally.</p>
      <button class="btn-present" style="width:100%; padding: 14px;" onclick="loadNMITCalendar()">Sync NMIT Calendar Dates</button>`;
  } else if (type === 'calendarMode') {
    if (!academicCalendar) html += `<h2>Calendar</h2><p style="color:var(--text-sub);">Sync the calendar from the menu first.</p>`;
    else {
      html += `<h2>Batch Mark Attendance</h2><div class="cal-grid">`;
      const start = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        let statusClass = '';
        if (academicCalendar.holidays && academicCalendar.holidays.includes(dateStr)) statusClass = 'holiday';
        else if (academicCalendar.importantDates && academicCalendar.importantDates.includes(dateStr)) statusClass = 'important';
        html += `<div class="cal-day ${statusClass}" onclick="markFullDayPresent('${dateStr}', this)">${d.getDate()}</div>`;
      }
      html += `</div><div style="margin-top:15px; display:flex; justify-content:center; gap:10px; font-size:0.75rem;"><span style="color:#e74c3c">■ Holiday</span> <span style="color:#3498db">■ Important</span></div>`;
    }
  } else if (type === 'addTimetable') {
    html += `<h2>Upload Timetable</h2><input type="file" accept="image/*" class="modal-input" onchange="processOCR(event)" />`; 
  } else if (type === 'setTarget') {
    html += `<h2>Set Target Attendance</h2>
      <div style="text-align:left; margin-top:15px;">
        <p style="font-size:0.85rem; color:var(--text-sub); margin-bottom:10px;">Enter the minimum attendance percentage required by your institution.</p>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <input type="number" id="targetInput" class="modal-input" style="margin-bottom: 0;" value="${targetPercentage}" min="1" max="100" />
          <span style="font-size:1.2rem; font-weight:800;">%</span>
        </div>
        <button class="btn-present" style="width:100%; padding:12px;" onclick="saveTargetPercentage()">Save Target</button>
      </div>`;
  } else if (type === 'addCourse') {
    html += `<h2>Add Custom Course</h2>
      <div style="text-align:left; margin-top:15px;">
        <label style="font-size:0.85rem; color:var(--text-sub);">Course Name</label>
        <input type="text" id="newCourseName" class="modal-input" placeholder="e.g. Data Structures" />
        <label style="font-size:0.85rem; color:var(--text-sub);">Course Code (Optional)</label>
        <input type="text" id="newCourseCode" class="modal-input" placeholder="e.g. 25CSE201" />
        <button class="btn-present" style="width:100%; padding:12px;" onclick="handleAddCourse()">Add Course</button>
      </div>`;
  } else if (type === 'editAttendance') {
    html += `<h2>Edit Attendance</h2><div style="max-height: 55vh; overflow-y: auto; margin-top: 15px;">`;
    if (courses.length === 0) html += `<p style="color:var(--text-sub);">No courses available to edit.</p>`;
    else {
      courses.forEach(c => {
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
            <span style="font-size:0.9rem; font-weight:700; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name}</span>
            <div style="display:flex; gap:6px; align-items:center;">
              <input type="number" min="0" value="${c.present}" id="edit-present-${c.id}" style="width:50px; padding:4px; text-align:center;" title="Present" />
              <input type="number" min="0" value="${c.absent}" id="edit-absent-${c.id}" style="width:50px; padding:4px; text-align:center;" title="Absent" />
              <button class="holiday-btn" onclick="saveIndividualAttendance(${c.id})">Save</button>
            </div>
          </div>`;
      });
    }
    html += `</div>`;
  } else if (type === 'removeCourse') {
    html += `<h2>Remove Course</h2><div style="max-height: 55vh; overflow-y: auto; margin-top: 15px;">`;
    if (courses.length === 0) html += `<p style="color:var(--text-sub);">No courses to remove.</p>`;
    else {
      courses.forEach(c => {
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
            <span style="font-size:0.9rem; font-weight:700;">${c.name}</span>
            <button class="btn-absent" style="padding:6px 12px; font-size:0.8rem;" onclick="removeCourseById(${c.id})">Delete</button>
          </div>`;
      });
    }
    html += `</div>`;
  }
  
  modalContent.innerHTML = html;
}

function saveTargetPercentage() {
  const inputVal = document.getElementById('targetInput').value;
  const newTarget = parseInt(inputVal, 10);
  if (isNaN(newTarget) || newTarget < 1 || newTarget > 100) {
    alert("Please enter a valid percentage between 1 and 100.");
    return;
  }
  targetPercentage = newTarget;
  localStorage.setItem('target_percentage', targetPercentage);
  renderUI();
  closeModal();
}

function handleAddCourse() {
  const name = document.getElementById('newCourseName').value.trim();
  const code = document.getElementById('newCourseCode').value.trim();
  if (!name) return alert("Please enter a course name.");
  courses.push({ id: Date.now(), name: name, code: code || 'CUSTOM', present: 0, absent: 0, schedule: {} });
  addHistory(`Added Course: ${name}`); saveToDatabase(); renderUI(); closeModal();
}

function saveIndividualAttendance(id) {
  const course = courses.find(c => c.id === id);
  const p = document.getElementById(`edit-present-${id}`).value;
  const a = document.getElementById(`edit-absent-${id}`).value;
  if (course) {
    course.present = Math.max(0, parseInt(p, 10) || 0);
    course.absent = Math.max(0, parseInt(a, 10) || 0);
    addHistory(`Updated: ${course.name} (P:${course.present}, A:${course.absent})`);
    saveToDatabase(); renderUI(); alert(`Saved attendance for ${course.name}`);
  }
}

function removeCourseById(id) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  if (confirm(`Are you sure you want to remove ${course.name}?`)) {
    courses = courses.filter(c => c.id !== id);
    addHistory(`Removed Course: ${course.name}`);
    saveToDatabase(); renderUI(); openModal('removeCourse');
  }
}

function getBunkStatus(present, absent) {
  const total = present + absent;
  if (total === 0) return `<span class="bunk-meter" style="color:var(--text-sub);">No classes yet</span>`;
  const currentPercent = (present / total) * 100;
  
  if (currentPercent >= targetPercentage) {
    const buffer = Math.floor((present / (targetPercentage / 100)) - total);
    return buffer > 0 ? `<span class="bunk-meter bunk-safe">Safe to bunk ${buffer} classes</span>` : `<span class="bunk-meter bunk-safe">On track (0 buffer)</span>`;
  } else {
    const required = Math.ceil(((targetPercentage / 100) * total - present) / (1 - (targetPercentage / 100)));
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
  if (courses.length === 0) { listContainer.innerHTML = `<p style="color:var(--text-sub); text-align:center; grid-column: 1/-1; padding: 40px 0;">No Courses Found. Add courses from the sidebar or scan a timetable.</p>`; return; }

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

startLiveClock(); updateHolidayButton(); renderUI(); setInterval(renderUI, 60000);
if (!localStorage.getItem('appManualShown')) { localStorage.setItem('appManualShown', 'true'); openModal('userManual'); }