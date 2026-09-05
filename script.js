const DB_KEY = 'attendance_tracker_v20';
const HISTORY_KEY = 'attendance_history_v20';
const CALENDAR_KEY = 'academic_calendar_v20';
const MARKED_DATES_KEY = 'marked_dates_v20';
const MANUAL_SHOWN_KEY = 'appManualShown_v20';

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
  const now = new Date(); 
  return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

// Perfectly synced to the Room 205 image provided
const masterScheduleMap = {
  '25CIV104': { name: 'Environmental Science', schedule: { Monday: [{ start: '09:00', end: '09:55' }], Tuesday: [{ start: '13:10', end: '14:25' }] } },
  '25ECE111': { name: 'Basic Electronics', schedule: { Monday: [{ start: '09:55', end: '10:50' }], Tuesday: [{ start: '11:55', end: '12:50' }], Thursday: [{ start: '09:55', end: '10:50' }], Saturday: [{ start: '09:00', end: '09:55' }] } },
  '25PHY102': { name: 'Physics / Quantum Computing', schedule: { Monday: [{ start: '11:00', end: '11:55' }], Tuesday: [{ start: '09:00', end: '10:50' }, { start: '14:25', end: '15:20' }], Wednesday: [{ start: '09:55', end: '10:50' }], Saturday: [{ start: '09:55', end: '10:50' }] } },
  '25MAT103': { name: 'Advanced Calculus', schedule: { Monday: [{ start: '11:55', end: '12:50' }], Wednesday: [{ start: '11:55', end: '12:50' }], Thursday: [{ start: '09:00', end: '09:55' }], Friday: [{ start: '09:55', end: '10:50' }], Saturday: [{ start: '11:00', end: '11:55' }] } },
  '25CSE103': { name: 'Problem Solving (Prog)', schedule: { Monday: [{ start: '13:10', end: '14:25' }], Thursday: [{ start: '11:55', end: '12:50' }], Friday: [{ start: '09:00', end: '09:55' }, { start: '11:00', end: '12:50' }], Saturday: [{ start: '11:55', end: '12:50' }] } },
  '25HSS131': { name: 'Communicative English', schedule: { Monday: [{ start: '14:25', end: '15:20' }] } },
  '25HSS132': { name: 'Knowing Yourself', schedule: { Tuesday: [{ start: '11:00', end: '11:55' }], Wednesday: [{ start: '11:00', end: '11:55' }], Thursday: [{ start: '11:00', end: '11:55' }] } },
  '25BTY111': { name: 'Biology for Engineers', schedule: { Wednesday: [{ start: '09:00', end: '09:55' }] } },
  '25PHYY102': { name: 'Physics Alt Lab', schedule: { Wednesday: [{ start: '13:10', end: '14:25' }] } },
  '25MAT107': { name: 'Math Numerical Methods', schedule: { Wednesday: [{ start: '14:25', end: '16:15' }] } },
  '25MEC122': { name: 'Mechanical Workshop', schedule: { Thursday: [{ start: '14:25', end: '16:15' }] } },
  '25HSS102': { name: 'Universal Human Values', schedule: { Friday: [{ start: '13:10', end: '15:20' }] } },
  '25HSS101': { name: 'Constitution of India', schedule: { Friday: [{ start: '15:20', end: '16:15' }] } },
  'LIBRARY': { name: 'Library', schedule: { Tuesday: [{ start: '15:20', end: '16:15' }] } },
  'MENTORING': { name: 'Mentoring / CT Interaction', schedule: { Saturday: [{ start: '13:10', end: '16:15' }] } }
};

function buildInitialDatabase() {
  const initialCourses = [];
  Object.keys(masterScheduleMap).forEach((code, index) => {
    initialCourses.push({ 
      id: Date.now() + index, 
      name: masterScheduleMap[code].name, 
      code: code, 
      present: 0, 
      absent: 0, 
      schedule: masterScheduleMap[code].schedule 
    });
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
    clockElement.innerHTML = `
      <div class="clock-time">${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
      <div class="clock-date">${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
    `;
  }, 1000);
}

function isTodayHoliday() { 
  return localStorage.getItem('holiday_' + getTodayDateString()) === 'true'; 
}

function toggleHoliday() {
  const todayStr = getTodayDateString();
  if (isTodayHoliday()) localStorage.removeItem('holiday_' + todayStr);
  else localStorage.setItem('holiday_' + todayStr, 'true');
  updateHolidayButton(); 
  renderUI(); 
}

function updateHolidayButton() {
  const btn = document.getElementById('holidayBtn');
  if (!btn) return;
  if (isTodayHoliday()) { 
    btn.classList.add('active'); 
    btn.innerText = 'HOLIDAY ACTIVE'; 
  } else { 
    btn.classList.remove('active'); 
    btn.innerText = 'Mark Today Holiday'; 
  }
}

// Automatically totals absent and present days starting from Term Start to Today
function getCalculatedAttendance() {
  let calc = {};
  courses.forEach(c => calc[c.id] = { p: 0, a: 0 });

  if (academicCalendar && academicCalendar.startDate) {
    let currDate = new Date(academicCalendar.startDate);
    currDate.setHours(0, 0, 0, 0);
    
    let endDate = new Date(getTodayDateString());
    endDate.setHours(0, 0, 0, 0);
    
    if (academicCalendar.endDate) {
      let termEnd = new Date(academicCalendar.endDate);
      termEnd.setHours(0, 0, 0, 0);
      if (termEnd < endDate) endDate = termEnd;
    }

    while(currDate <= endDate) {
      const dateStr = `${currDate.getFullYear()}-${String(currDate.getMonth() + 1).padStart(2, '0')}-${String(currDate.getDate()).padStart(2, '0')}`;
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currDate.getDay()];

      const isHoliday = academicCalendar.holidays && academicCalendar.holidays.includes(dateStr);
      const isMarked = markedDates.includes(dateStr);

      if (!isHoliday) {
        courses.forEach(course => {
          if (course.schedule && course.schedule[dayName]) {
            const classesThatDay = course.schedule[dayName].length;
            if (isMarked) {
              calc[course.id].p += classesThatDay; 
            } else {
              calc[course.id].a += classesThatDay; 
            }
          }
        });
      }
      currDate.setDate(currDate.getDate() + 1);
    }
  }
  return calc;
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
  
  const previewWrapper = document.getElementById('previewWrapper');
  const isImage = file.type.match(/image/i) || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i);
  
  previewWrapper.ontouchstart = null;
  previewWrapper.ontouchmove = null;
  previewWrapper.ontouchend = null;

  if (isImage) {
    previewWrapper.innerHTML = `<img id="setupImagePreview" src="${setupBlobUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:contain; display:block; transform-origin:center;" alt="Calendar Preview" />`;
    
    const img = document.getElementById('setupImagePreview');
    let scale = 1, posX = 0, posY = 0;
    let startX, startY, initialDist;

    previewWrapper.ontouchstart = (e) => {
      if (e.touches.length === 2) {
        initialDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      } else if (e.touches.length === 1) {
        startX = e.touches[0].clientX - posX;
        startY = e.touches[0].clientY - posY;
      }
    };

    previewWrapper.ontouchmove = (e) => {
      e.preventDefault(); 
      if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        scale = Math.min(Math.max(1, scale * (dist / initialDist)), 6); 
        initialDist = dist;
      } else if (e.touches.length === 1 && scale > 1) {
        posX = e.touches[0].clientX - startX;
        posY = e.touches[0].clientY - startY;
      }
      img.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
    };

    previewWrapper.ontouchend = () => {
      if (scale <= 1) {
        scale = 1; posX = 0; posY = 0;
        img.style.transition = 'transform 0.2s ease';
        img.style.transform = `translate(0px, 0px) scale(1)`;
        setTimeout(() => img.style.transition = 'none', 200);
      }
    };

  } else {
    previewWrapper.innerHTML = `<iframe src="${setupBlobUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; background:white;"></iframe>`;
  }
  
  setupTempData = {}; 
  buildSetupCalendar(setupStartDate, setupEndDate);
  
  closeModal();
  document.getElementById('splitScreenOverlay').classList.add('active');
}

function buildSetupCalendar(startStr, endStr) {
  const container = document.getElementById('setupCalendarContainer');
  let html = '';
  
  let startDate = new Date(startStr);
  let endDate = new Date(endStr);
  
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
    
    html += `
      <div class="setup-month">
        <div class="setup-month-title">${monthNames[month]} ${year}</div>
        <div class="cal-weekdays"><span>Su</span><span>M</span><span>Tu</span><span>W</span><span>Th</span><span>F</span><span>Sa</span></div>
        <div class="cal-grid-month">`;
    
    for (let i = 0; i < firstDay; i++) { 
      html += `<div class="cal-day empty"></div>`; 
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const iterDate = new Date(year, month, i);
      const isSunday = iterDate.getDay() === 0 ? 'sunday' : '';
      
      html += `<div class="cal-day ${isSunday}" id="setup-${dateStr}" onclick="cyclePaintMode('${dateStr}', this)"><span>${i}</span></div>`;
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
  if (previewWrapper) {
      previewWrapper.innerHTML = '';
      previewWrapper.ontouchstart = null;
      previewWrapper.ontouchmove = null;
      previewWrapper.ontouchend = null;
  }
  if (setupBlobUrl) {
    URL.revokeObjectURL(setupBlobUrl);
    setupBlobUrl = null;
  }
}

async function processOCR(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('ocrLoading').classList.add('active');
  closeModal();

  setTimeout(() => {
    document.getElementById('ocrLoading').classList.remove('active');
    courses = buildInitialDatabase(); 
    saveToDatabase(); 
    renderUI();
    alert("Timetable successfully loaded!");
    event.target.value = '';
  }, 1000);
}

function changeCalendarMonth(dir) {
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
  }
  
  saveToDatabase(); 
  openModal('calendarMode'); 
  renderUI(); 
}

function toggleMenu() { 
  document.getElementById('sidebar').classList.toggle('open'); 
  document.getElementById('menuOverlay').classList.toggle('active'); 
}

function closeModal(e) { 
  if (e && e.target !== document.getElementById('modalOverlay') && !e.target.classList.contains('close-btn')) return; 
  document.getElementById('modalOverlay').classList.remove('active'); 
}

function openModal(type) {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('menuOverlay').classList.remove('active');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalOverlay.classList.add('active');
  let html = `<button class="close-btn" onclick="closeModal()">×</button>`;

  if (type === 'userManual') {
    html += `
      <h2>How to Use This App</h2>
      <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px; text-align: left;">
        <div class="manual-section" style="margin-bottom:15px;">
          <h3 style="font-size:1rem; margin-bottom:4px;">1. Getting Started</h3>
          <p style="font-size:0.85rem; color:var(--text-sub);">The app starts empty. Use <b>Upload Timetable (OCR)</b> to scan your schedule.</p>
        </div>
        <div class="manual-section" style="margin-bottom:15px;">
          <h3 style="font-size:1rem; margin-bottom:4px;">2. Set Term & Calendar</h3>
          <p style="font-size:0.85rem; color:var(--text-sub);"><b>CRITICAL:</b> Upload your calendar to set the <b>Term Start Date</b>. The app will automatically mark you absent for every scheduled class between the start date and today unless marked green.</p>
        </div>
        <div class="manual-section" style="margin-bottom:15px;">
          <h3 style="font-size:1rem; margin-bottom:4px;">3. Daily Tracking</h3>
          <p style="font-size:0.85rem; color:var(--text-sub);">Tap the clock icon. Tap any past/present date to turn it <b>Green (Present)</b>. Future dates and pre-term dates are locked.</p>
        </div>
        <div class="manual-section" style="margin-bottom:15px;">
          <h3 style="font-size:1rem; margin-bottom:4px;">4. Bunk Meter</h3>
          <p style="font-size:0.85rem; color:var(--text-sub);">Set your target percentage in the menu. Each card displays safe bunks remaining or the exact number of classes you must attend.</p>
        </div>
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
        const isBeforeStart = dateStr < academicCalendar.startDate ? 'future' : ''; // Visually lock out pre-term dates
        const isMarked = markedDates.includes(dateStr) ? 'present' : '';
        
        html += `<div class="cal-day ${statusClass} ${isSunday} ${isFuture} ${isBeforeStart} ${isMarked}" onclick="toggleFullDayPresent('${dateStr}')"><span>${i}</span></div>`;
      }
      
      html += `</div>
        <div style="margin-top:20px; display:flex; justify-content:center; gap:15px; font-size:0.85rem; font-weight:700;">
          <span style="color:#9b2226">■ Holiday</span> 
          <span style="color:#005f73">■ Important</span>
          <span style="color:#2ecc71">■ Present</span>
        </div>`;
    }
  } else if (type === 'addTimetable') {
    html += `
      <h2>Upload Timetable</h2>
      <p style="color:var(--text-sub); margin-top:8px; margin-bottom:15px; font-size:0.9rem;">Upload your timetable image to load your courses automatically.</p>
      <input type="file" accept="image/*" class="modal-input" onchange="processOCR(event)" />`; 
  } else if (type === 'setTarget') {
    html += `
      <h2>Set Target Attendance</h2>
      <div style="text-align:left; margin-top:15px;">
        <p style="font-size:0.85rem; color:var(--text-sub); margin-bottom:10px;">Enter the minimum attendance percentage required by your institution.</p>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <input type="number" id="targetInput" class="modal-input" style="margin-bottom: 0;" value="${targetPercentage}" min="1" max="100" />
          <span style="font-size:1.2rem; font-weight:800;">%</span>
        </div>
        <button class="btn-present" style="width:100%; padding:12px;" onclick="saveTargetPercentage()">Save Target</button>
      </div>`;
  } else if (type === 'addCourse') {
    html += `
      <h2>Add Custom Course</h2>
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
    if (courses.length === 0) {
      html += `<p style="color:var(--text-sub);">No courses to remove.</p>`;
    } else {
      courses.forEach(c => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
            <span style="font-size:0.9rem; font-weight:700; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name}</span>
            <button onclick="removeCourseById(${c.id})" style="background:#e74c3c; color:white; border:none; width:32px; height:32px; border-radius:50%; font-size:1.2rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;">-</button>
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
  
  const baseStats = getCalculatedAttendance();
  const totalPresent = baseStats[course.id].p + course.present;
  const totalAbsent = baseStats[course.id].a + course.absent;
  
  const total = totalPresent + totalAbsent;
  const percent = total === 0 ? 0 : Math.round((totalPresent / total) * 100);
  
  document.getElementById('editPresent').value = totalPresent;
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
    pctEl.value = t > 0 ? Math.round((p / t) * 100) : 0;
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

  const baseStats = getCalculatedAttendance();
  
  course.present = p - baseStats[course.id].p;
  course.absent = (t - p) - baseStats[course.id].a;

  addHistory(`Edited: ${course.name} (Now P:${p}, Total:${t})`);
  saveToDatabase();
  renderUI();
  alert(`Attendance updated for ${course.name}`);
  closeModal();
}

function handleAddCourse() {
  const name = document.getElementById('newCourseName').value.trim();
  const code = document.getElementById('newCourseCode').value.trim();
  if (!name) return alert("Please enter a course name.");
  courses.push({ id: Date.now(), name: name, code: code || 'CUSTOM', present: 0, absent: 0, schedule: {} });
  addHistory(`Added Course: ${name}`); 
  saveToDatabase(); 
  renderUI(); 
  closeModal();
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

function removeCourseById(id) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  if (confirm(`Are you sure you want to remove ${course.name}?`)) {
    courses = courses.filter(c => c.id !== id);
    addHistory(`Removed Course: ${course.name}`);
    saveToDatabase(); 
    renderUI(); 
    openModal('removeCourse');
  }
}

function getBunkStatus(present, absent) {
  const total = present + absent;
  if (total === 0) return `<span class="bunk-meter" style="color:var(--text-sub);">No classes yet</span>`;
  const currentPercent = (present / total) * 100;
  
  if (currentPercent >= targetPercentage) {
    const buffer = Math.floor((present / (targetPercentage / 100)) - total);
    return buffer > 0 
      ? `<span class="bunk-meter bunk-safe">Safe to bunk ${buffer} classes</span>` 
      : `<span class="bunk-meter bunk-safe">On track (0 buffer)</span>`;
  } else {
    const required = Math.ceil(((targetPercentage / 100) * total - present) / (1 - (targetPercentage / 100)));
    return `<span class="bunk-meter bunk-danger">Attend next ${required} classes</span>`;
  }
}

function changeDay(dayName) { 
  currentSelectedDay = dayName; 
  renderUI(); 
}

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
    courses.forEach(c => { 
      if (c.schedule && c.schedule[currentSelectedDay]) {
        c.schedule[currentSelectedDay].forEach(slot => { 
          todaysClasses.push({ name: c.name, start: slot.start, end: slot.end }); 
        });
      }
    });
    
    if (todaysClasses.length === 0) {
      timeContainer.innerHTML = `<p style="color:var(--text-sub);">No classes scheduled.</p>`;
    } else {
      todaysClasses.sort((a, b) => a.start.localeCompare(b.start));
      const now = new Date(); 
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      let html = '';
      todaysClasses.forEach(cls => {
        let status = '';
        if (isToday) { 
          if (currentTime >= cls.start && currentTime <= cls.end) status = 'active'; 
          else if (currentTime > cls.end) status = 'past'; 
        }
        html += `
          <div class="timeline-card ${status}">
            <div class="timeline-time">${format12Hour(cls.start)} - ${format12Hour(cls.end)}</div>
            <div class="timeline-course">${cls.name}</div>
          </div>`;
      });
      timeContainer.innerHTML = html;
    }
  }

  const listContainer = document.getElementById('courseList');
  listContainer.innerHTML = '';
  if (courses.length === 0) { 
    listContainer.innerHTML = `<p style="color:var(--text-sub); text-align:center; grid-column: 1/-1; padding: 40px 0;">No Courses Found. Add courses from the sidebar or scan a timetable.</p>`; 
    return; 
  }

  const holidayMode = isTodayHoliday();
  const baseStats = getCalculatedAttendance();

  courses.forEach(course => {
    const totalPresent = baseStats[course.id].p + course.present;
    const totalAbsent = baseStats[course.id].a + course.absent;
    const total = totalPresent + totalAbsent;
    
    const percentage = total === 0 ? 0 : Math.round((totalPresent / total) * 100);
    const dashOffset = (2 * Math.PI * 38) - ((percentage / 100) * (2 * Math.PI * 38));
    let actionHTML = holidayMode 
      ? `<div class="action-bar" id="action-${course.id}"><span style="font-weight: 800; color: #e74c3c;">HOLIDAY</span></div>` 
      : `<div class="action-bar" id="action-${course.id}"><button class="btn-present" onclick="markAttendance(${course.id}, 'present')">PRESENT</button><button class="btn-absent" onclick="markAttendance(${course.id}, 'absent')">ABSENT</button></div>`;

    listContainer.innerHTML += `
      <div class="course-card-wrapper">
        <div class="course-card" onclick="toggleActionBar(${course.id})">
          <div class="progress-circle">
            <svg width="90" height="90">
              <circle cx="45" cy="45" r="38" stroke="#e74c3c" stroke-width="8" fill="transparent" />
              <circle cx="45" cy="45" r="38" stroke="#2ecc71" stroke-width="8" fill="transparent" stroke-dasharray="238.7" stroke-dashoffset="${dashOffset}" stroke-linecap="round" style="transition: stroke-dashoffset 1s ease-in-out;" />
            </svg>
            <div class="percentage-text" style="color:var(--text-main);">${percentage}%</div>
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
  if (status === 'present') course.present += 1;
  if (status === 'absent') course.absent += 1;
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

startLiveClock(); 
updateHolidayButton(); 
renderUI(); 
setInterval(renderUI, 60000);

if (!localStorage.getItem(MANUAL_SHOWN_KEY)) { 
  localStorage.setItem(MANUAL_SHOWN_KEY, 'true'); 
  setTimeout(() => openModal('userManual'), 300);
}