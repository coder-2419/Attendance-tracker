const DB_KEY = 'attendance_tracker_v12';
const HISTORY_KEY = 'attendance_history_v2';
const CALENDAR_KEY = 'academic_calendar_v2';
const MARKED_DATES_KEY = 'marked_dates_v1';

let targetPercentage = parseInt(localStorage.getItem('target_percentage')) || 75;
let courses = loadFromDatabase();
let historyLog = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let academicCalendar = JSON.parse(localStorage.getItem(CALENDAR_KEY)) || null;
let markedDates = JSON.parse(localStorage.getItem(MARKED_DATES_KEY)) || [];
let currentSelectedDay = getTodayString();
let currentCalDate = new Date(); 

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

function getTodayDateString() {
  const now = new Date(); return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
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
  localStorage.setItem(MARKED_DATES_KEY, JSON.stringify(markedDates));
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
  document.getElementById('filePreview').src = setupBlobUrl;
  
  setupTempData = {}; 
  buildSetupCalendar(setupStartDate, setupEndDate);
  
  closeModal();
  document.getElementById('splitScreenOverlay').classList.add('active');
}

function buildSetupCalendar(startStr, endStr) {
  const container = document.getElementById('setupCalendarContainer');
  let html = '';
  let curr = new Date(startStr);
  const end = new Date(endStr);
  
  while (curr <= end || (curr.getMonth() === end.getMonth() && curr.getFullYear() === end.getFullYear())) {
    const year = curr.getFullYear();
    const month = curr.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    
    html += `
      <div class="setup-month">
        <div class="setup-month-title">${monthNames[month]} ${year}</div>
        <div class="cal-weekdays"><span>Su</span><span>M</span><span>Tu</span><span>W</span><span>Th</span><span>F</span><span>Sa</span></div>
        <div class="cal-grid-month">`;
    
    for (let i = 0; i < firstDay; i++) { html += `<div class="cal-day empty"></div>`; }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const iterDate = new Date(year, month, i);
      const isOutOfBounds = iterDate < new Date(startStr) || iterDate > new Date(endStr);
      const isSunday = iterDate.getDay() === 0 ? 'sunday' : '';
      
      if (isOutOfBounds) {
        html += `<div class="cal-day empty"></div>`;
      } else {
        html += `<div class="cal-day ${isSunday}" id="setup-${dateStr}" onclick="cyclePaintMode('${dateStr}', this)"><span>${i}</span></div>`;
      }
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
  if (setupBlobUrl) {
    URL.revokeObjectURL(setupBlobUrl);
    setupBlobUrl = null;
    document.getElementById('filePreview').src = '';
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
    } else { alert("Could not recognize this as the timetable."); }
  } catch (error) { alert("Error reading image."); console.error(error);
  } finally { document.getElementById('ocrLoading').classList.remove('active'); event.target.value = ''; }
}

function changeCalendarMonth(dir) {
  currentCalDate.setMonth(currentCalDate.getMonth() + dir);
  openModal('calendarMode');
}

function toggleFullDayPresent(dateString) {
  const todayStr = getTodayDateString();
  
  if (dateString > todayStr) {
    alert("You cannot mark attendance for future dates.");
    return;
  }

  const dateObj = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[dateObj.getDay()];
  let classesUpdated = 0;
  
  const isAlreadyMarked = markedDates.includes(dateString);

  courses.forEach(course => {
    if (course.schedule && course.schedule[dayName]) {
      course.schedule[dayName].forEach(() => { 
        if (isAlreadyMarked) {
          course.present = Math.max(0, course.present - 1); 
        } else {
          course.present += 1; 
        }
        classesUpdated += 1; 
      });
    }
  });

  if (classesUpdated > 0) {
    if (isAlreadyMarked) {
      markedDates = markedDates.filter(d => d !== dateString);
      addHistory(`Reversed Full Day: ${dateString}`);
    } else {
      markedDates.push(dateString);
      addHistory(`Full Day Present: ${dateString}`);
    }
    saveToDatabase(); 
    openModal('calendarMode'); 
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
    html += `<h2>How to Use This App</h2><div style="max-height: 60vh; overflow-y: auto; padding-right: 10px; text-align: left;">
      <div class="manual-section"><h3>1. Getting Started</h3><p>App starts empty. Go to the menu to add courses manually, or use the <b>Upload Timetable (OCR)</b> tool.</p></div>
      <div class="manual-section"><h3>2. Academic Calendar</h3><p>Use the Sync option to launch Setup Mode. Mark holidays in Red and important dates in Blue.</p></div>
      <div class="manual-section"><h3>3. Batch Mark Attendance</h3><p>Tap the clock icon. Tap any past or current date to mark attendance for the whole day (Green). Tap again to undo.</p></div>
      <div class="manual-section"><h3>4. The Bunk Meter</h3><p>Tracks your configured threshold, telling you if you can bunk safely or need to attend.</p></div>
    </div>`;
  } else if (type === 'historyLog') {
    html += `<h2>History Log</h2><div class="history-list">`;
    if (historyLog.length === 0) html += `<p style="color:var(--text-sub);">No history yet.</p>`;
    historyLog.forEach(log => { html += `<div class="history-item"><span>${log.action}</span><span style="color:var(--text-sub); font-size:0.75rem;">${log.time}</span></div>`; });
    html += `</div>`;
  } else if (type === 'setupCalendar') {
    html += `<h2>Upload Academic Calendar</h2>
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
      html += `<h2>Calendar</h2><p style="color:var(--text-sub);">Sync the calendar from the menu first.</p>`;
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

      for (let i = 0; i < firstDay; i++) {
        html += `<div class="cal-day empty"></div>`;
      }

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
          <span style="color:#2ecc71">■ Present</span>
        </div>`;
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
    if (courses.length === 0) {
      html += `<h2>Edit Attendance</h2><p style="color:var(--text-sub); margin-top:15px;">No courses available to edit.</p>`;
    } else {
      let options = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      html += `
        <h2>Edit Attendance</h2>
        <div style="margin-top:15px; text-align: left;">
          <label style="font-size:0.85rem; color:var(--text-sub);">Select Course</label>
          <select id="editCourseSelect" class="modal-input" onchange="loadCourseToEdit()" style="margin-bottom: 25px;">
            ${options}
          </select>
          <div style="display:flex; gap:15px; align-items:stretch; margin-bottom:25px;">
            <div style="display:flex; flex-direction:column; gap:15px; flex:1;">
              <div>
                <label style="font-size:0.85rem; color:var(--text-sub);">Present</label>
                <input type="number" id="editPresent" class="modal-input" style="margin-bottom:0; padding:10px;" min="0" oninput="syncEditFields('present')" />
              </div>
              <div>
                <label style="font-size:0.85rem; color:var(--text-sub);">Total Classes</label>
                <input type="number" id="editTotal" class="modal-input" style="margin-bottom:0; padding:10px;" min="0" oninput="syncEditFields('total')" />
              </div>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid var(--border-color); box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);">
              <label style="font-size:0.85rem; color:var(--text-sub); margin-bottom:8px;">Percentage</label>
              <div style="display:flex; align-items:center; gap:5px;">
                <input type="number" id="editPercent" class="modal-input" style="margin-bottom:0; width:70px; text-align:center; font-size:1.2rem; font-weight:800; padding:8px;" min="0" max="100" oninput="syncEditFields('percent')" />
                <span style="font-size:1.2rem; font-weight:800;">%</span>
              </div>
            </div>
          </div>
          <button class="btn-present" style="width:100%; padding:14px;" onclick="saveSingleCourseAttendance()">Save Changes</button>
        </div>`;
        setTimeout(loadCourseToEdit, 0); 
    }
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

function loadCourseToEdit() {
  const select = document.getElementById('editCourseSelect');
  if (!select) return;
  const course = courses.find(c => c.id === parseInt(select.value, 10));
  if (!course) return;
  
  const total = course.present + course.absent;
  const percent = total === 0 ? 0 : Math.round((course.present / total) * 100);
  
  document.getElementById('editPresent').value = course.present;
  document.getElementById('editTotal').value = total;
  document.getElementById('editPercent').value = percent;
}

function syncEditFields(source) {
  const pEl = document.getElementById('editPresent');
  const tEl = document.getElementById('editTotal');
  const pctEl = document.getElementById('editPercent');
  
  let p = parseFloat(pEl.value) || 0;
  let t = parseFloat(tEl.value) || 0;
  let pct = parseFloat(pctEl.value) || 0;

  if (source === 'present' || source === 'total') {
    if (t > 0) {
      pctEl.value = Math.round((p / t) * 100);
    } else {
      pctEl.value = 0;
    }
  } else if (source === 'percent') {
    if (t > 0) {
      pEl.value = Math.round((pct / 100) * t);
    }
  }
}

function saveSingleCourseAttendance() {
  const select = document.getElementById('editCourseSelect');
  if (!select) return;
  
  const courseId = parseInt(select.value, 10);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;

  let p = parseInt(document.getElementById('editPresent').value, 10) || 0;
  let t = parseInt(document.getElementById('editTotal').value, 10) || 0;
  
  if (p > t) t = p;

  course.present = Math.max(0, p);
  course.absent = Math.max(0, t - p);

  addHistory(`Edited: ${course.name} (P:${course.present}, Total:${t})`);
  saveToDatabase();
  renderUI();
  alert(`Attendance updated for ${course.name}`);
  closeModal();
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