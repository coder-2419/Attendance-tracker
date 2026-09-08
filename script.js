"use strict";

/* ============================================================
   ATTENDANCE TRACKER
============================================================ */

/* ============================================================
   DEFAULT TIMETABLE
============================================================ */

const DEFAULT_TIMETABLE = {
  Mon: [
    {
      start: "09:00",
      end: "09:55",
      code: "25CIV104"
    },
    {
      start: "09:55",
      end: "10:50",
      code: "25ECE111"
    },
    {
      start: "11:00",
      end: "11:55",
      code: "25PHY102"
    },
    {
      start: "11:55",
      end: "12:50",
      code: "25MAT103"
    },
    {
      start: "13:30",
      end: "14:25",
      code: "25CSE103"
    },
    {
      start: "14:25",
      end: "15:20",
      code: "25HSS131"
    }
  ],

  Tue: [
    {
      start: "09:00",
      end: "10:50",
      code: "PHYSICS_LAB"
    },
    {
      start: "11:00",
      end: "11:55",
      code: "25HSS131"
    },
    {
      start: "11:55",
      end: "12:50",
      code: "25ECE111"
    },
    {
      start: "13:30",
      end: "14:25",
      code: "25CIV104"
    },
    {
      start: "14:25",
      end: "15:20",
      code: "25PHY102"
    }
  ],

  Wed: [
    {
      start: "09:00",
      end: "09:55",
      code: "25BTY111"
    },
    {
      start: "09:55",
      end: "10:50",
      code: "25PHY102"
    },
    {
      start: "11:00",
      end: "11:55",
      code: "25HSS132"
    },
    {
      start: "11:55",
      end: "12:50",
      code: "25MAT103"
    },
    {
      start: "13:30",
      end: "14:25",
      code: "25PHY102"
    },
    {
      start: "14:25",
      end: "16:15",
      code: "25MAT107"
    }
  ],

  Thu: [
    {
      start: "09:00",
      end: "09:55",
      code: "25MAT103"
    },
    {
      start: "09:55",
      end: "10:50",
      code: "25ECE111"
    },
    {
      start: "11:00",
      end: "11:55",
      code: "25HSS131"
    },
    {
      start: "11:55",
      end: "12:50",
      code: "25CSE103"
    },
    {
      start: "14:25",
      end: "16:15",
      code: "25MEC122"
    }
  ],

  Fri: [
    {
      start: "09:00",
      end: "09:55",
      code: "25CSE103"
    },
    {
      start: "09:55",
      end: "10:50",
      code: "25MAT103"
    },
    {
      start: "11:00",
      end: "12:50",
      code: "CSE_LAB"
    },
    {
      start: "13:30",
      end: "16:15",
      code: "25HSS102"
    }
  ],

  Sat: [
    {
      start: "09:00",
      end: "09:55",
      code: "25ECE111"
    },
    {
      start: "09:55",
      end: "10:50",
      code: "25PHY102"
    },
    {
      start: "11:00",
      end: "11:55",
      code: "25MAT103"
    },
    {
      start: "11:55",
      end: "12:50",
      code: "25CSE103"
    }
  ]
};

const DAY_KEYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];

const DAY_NAMES = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday"
};

const DEFAULT_SUBJECT_NAMES = {
  "25CIV104":
    "Civil Engineering",

  "25ECE111":
    "Electronics & Communication",

  "25PHY102":
    "Physics",

  "25MAT103":
    "Mathematics",

  "25CSE103":
    "Computer Science",

  "25HSS131":
    "Humanities & Social Sciences",

  "25BTY111":
    "Biotechnology",

  "25HSS132":
    "Humanities & Social Sciences II",

  "25MAT107":
    "Mathematics II",

  "25MEC122":
    "Mechanical Engineering",

  "25HSS102":
    "Humanities & Social Sciences III",

  "PHYSICS_LAB":
    "Physics Lab",

  "CSE_LAB":
    "Computer Science Lab"
};

const STORAGE_KEY =
  "attendanceTrackerDB_v5";

/* ============================================================
   HELPERS
============================================================ */

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function todayISO() {
  const d =
    new Date();

  return [
    d.getFullYear(),

    String(
      d.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      d.getDate()
    ).padStart(
      2,
      "0"
    )
  ].join("-");
}

function toISODate(date) {
  const d =
    new Date(date);

  return [
    d.getFullYear(),

    String(
      d.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      d.getDate()
    ).padStart(
      2,
      "0"
    )
  ].join("-");
}

function dateFromISO(
  iso
) {
  const parts =
    iso.split("-")
      .map(Number);

  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
  );
}

function formatDate(
  iso,
  options = {}
) {
  return dateFromISO(
    iso
  ).toLocaleDateString(
    undefined,
    {
      weekday:
        options.weekday,

      day:
        options.day ||
        "numeric",

      month:
        options.month ||
        "short",

      year:
        options.year
    }
  );
}

function formatFullDate(
  iso
) {
  return dateFromISO(
    iso
  ).toLocaleDateString(
    undefined,
    {
      weekday:
        "long",

      day:
        "numeric",

      month:
        "long",

      year:
        "numeric"
    }
  );
}

function timeToMinutes(
  time
) {
  if (!time) {
    return 0;
  }

  const parts =
    time
      .split(":")
      .map(Number);

  return (
    parts[0] * 60 +
    parts[1]
  );
}

function currentMinutes() {
  const d =
    new Date();

  return (
    d.getHours() * 60 +
    d.getMinutes()
  );
}

function isSunday(
  iso
) {
  return (
    dateFromISO(
      iso
    ).getDay() === 0
  );
}

function getDateDayKey(
  iso
) {
  const day =
    dateFromISO(
      iso
    ).getDay();

  if (
    day === 0
  ) {
    return "Sun";
  }

  return DAY_KEYS[
    day - 1
  ];
}

function getTodayDayKey() {
  const day =
    new Date().getDay();

  if (
    day === 0
  ) {
    return "Mon";
  }

  return DAY_KEYS[
    day - 1
  ];
}

function escapeHTML(
  value
) {
  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function escapeAttribute(
  value
) {
  return escapeHTML(
    value
  );
}

/* ============================================================
   DEFAULT TERM DATE
============================================================ */

function defaultTermStart() {
  const d =
    new Date();

  d.setMonth(6);
  d.setDate(1);

  if (
    d > new Date()
  ) {
    d.setFullYear(
      d.getFullYear() - 1
    );
  }

  return toISODate(d);
}

/* ============================================================
   STATE
============================================================ */

function createDefaultState() {
  return {
    theme:
      "light",

    target:
      75,

    termStart:
      defaultTermStart(),

    timetable:
      clone(
        DEFAULT_TIMETABLE
      ),

    subjectNames:
      clone(
        DEFAULT_SUBJECT_NAMES
      ),

    calendarStates:
      {},

    marks:
      {},

    adjustments:
      {},

    history:
      [],

    calendarUploadedName:
      ""
  };
}

function normalizeTimetable(
  input
) {
  const output =
    clone(
      DEFAULT_TIMETABLE
    );

  if (
    !input ||
    typeof input !==
      "object"
  ) {
    return output;
  }

  DAY_KEYS.forEach(
    day => {
      if (
        !Array.isArray(
          input[day]
        )
      ) {
        return;
      }

      output[day] =
        input[day]
          .filter(
            item =>
              item &&
              typeof item.start ===
                "string" &&
              typeof item.end ===
                "string" &&
              typeof item.code ===
                "string" &&
              item.code.trim()
          )
          .map(
            item => ({
              start:
                item.start,

              end:
                item.end,

              code:
                item.code
                  .trim()
                  .toUpperCase()
            })
          )
          .sort(
            (a, b) =>
              timeToMinutes(
                a.start
              ) -
              timeToMinutes(
                b.start
              )
          );
    }
  );

  return output;
}

function loadState() {
  const stored =
    localStorage.getItem(
      STORAGE_KEY
    );

  if (!stored) {
    const fresh =
      createDefaultState();

    persistState(
      fresh
    );

    return fresh;
  }

  let parsed;

  try {
    parsed =
      JSON.parse(
        stored
      );
  }
  catch {
    parsed =
      null;
  }

  if (
    !parsed ||
    typeof parsed !==
      "object"
  ) {
    const fresh =
      createDefaultState();

    persistState(
      fresh
    );

    return fresh;
  }

  const defaults =
    createDefaultState();

  return {
    ...defaults,

    ...parsed,

    target:
      clamp(
        Number(
          parsed.target
        ) || 75,
        1,
        100
      ),

    timetable:
      normalizeTimetable(
        parsed.timetable
      ),

    subjectNames: {
      ...defaults.subjectNames,
      ...(parsed.subjectNames ||
        {})
    },

    calendarStates:
      parsed.calendarStates ||
      {},

    marks:
      parsed.marks ||
      {},

    adjustments:
      parsed.adjustments ||
      {},

    history:
      Array.isArray(
        parsed.history
      )
        ? parsed.history
        : [],

    theme:
      parsed.theme ===
      "dark"
        ? "dark"
        : "light"
  };
}

function persistState(
  current = state
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      current
    )
  );
}

let state =
  loadState();

/* ============================================================
   APP STATE
============================================================ */

const app = {
  selectedDay:
    getTodayDayKey(),

  openCourse:
    null,

  modalCloseHandler:
    null,

  calendarViewYear:
    new Date().getFullYear(),

  calendarPreview: {
    scale:
      1,

    minScale:
      1,

    maxScale:
      4,

    startDistance:
      0,

    startScale:
      1
  }
};

/* ============================================================
   DOM
============================================================ */

const $ =
  selector =>
    document.querySelector(
      selector
    );

const $$ =
  selector =>
    Array.from(
      document.querySelectorAll(
        selector
      )
    );

const els = {
  sidebar:
    $("#sidebar"),

  sidebarOverlay:
    $("#sidebarOverlay"),

  sidebarClose:
    $("#sidebarClose"),

  hamburger:
    $("#hamburger"),

  themeToggle:
    $("#themeToggle"),

  themeIcon:
    $("#themeIcon"),

  liveClock:
    $("#liveClock"),

  liveDate:
    $("#liveDate"),

  headerDay:
    $("#headerDay"),

  targetAttendanceValue:
    $("#targetAttendanceValue"),

  targetInline:
    $("#targetInline"),

  termStartValue:
    $("#termStartValue"),

  termStartLabel:
    $("#termStartLabel"),

  markTodayHoliday:
    $("#markTodayHoliday"),

  daySelector:
    $("#daySelector"),

  selectedDayDate:
    $("#selectedDayDate"),

  holidayBanner:
    $("#holidayBanner"),

  livePromptContainer:
    $("#livePromptContainer"),

  timelineSection:
    $("#timelineSection"),

  timeline:
    $("#timeline"),

  courseGrid:
    $("#courseGrid"),

  emptyState:
    $("#emptyState"),

  modalBackdrop:
    $("#modalBackdrop"),

  modal:
    $("#modal"),

  modalClose:
    $("#modalClose"),

  modalTitle:
    $("#modalTitle"),

  modalSubtitle:
    $("#modalSubtitle"),

  modalBody:
    $("#modalBody")
};

/* ============================================================
   CLOCK
   IMPORTANT:
   This function does NOT render the entire app.
============================================================ */

function updateClock() {
  const now =
    new Date();

  const clock =
    document.getElementById(
      "liveClock"
    );

  const date =
    document.getElementById(
      "liveDate"
    );

  const dayElement =
    document.getElementById(
      "headerDay"
    );

  if (
    clock
  ) {
    clock.textContent =
      now.toLocaleTimeString(
        undefined,
        {
          hour:
            "2-digit",

          minute:
            "2-digit",

          second:
            "2-digit",

          hour12:
            false
        }
      );
  }

  if (
    date
  ) {
    date.textContent =
      now.toLocaleDateString(
        undefined,
        {
          weekday:
            "short",

          day:
            "2-digit",

          month:
            "short",

          year:
            "numeric"
        }
      );
  }

  if (
    dayElement
  ) {
    const day =
      now.getDay();

    if (
      day === 0
    ) {
      dayElement.textContent =
        "Sunday • Holiday";
    }
    else {
      dayElement.textContent =
        DAY_NAMES[
          DAY_KEYS[
            day - 1
          ]
        ];
    }
  }
}

function startClock() {
  updateClock();

  setInterval(
    updateClock,
    1000
  );
}

/* ============================================================
   THEME
============================================================ */

function applyTheme() {
  document.documentElement.dataset.theme =
    state.theme;

  els.themeToggle.checked =
    state.theme ===
    "dark";

  els.themeIcon.textContent =
    state.theme ===
    "dark"
      ? "☾"
      : "☀";

  const themeMeta =
    document.querySelector(
      'meta[name="theme-color"]'
    );

  if (
    themeMeta
  ) {
    themeMeta.content =
      state.theme ===
      "dark"
        ? "#10141b"
        : "#f5f7fb";
  }
}

els.themeToggle.addEventListener(
  "change",
  () => {
    state.theme =
      els.themeToggle.checked
        ? "dark"
        : "light";

    persistState();

    applyTheme();
  }
);

/* ============================================================
   SIDEBAR
============================================================ */

function openSidebar() {
  document.body.classList.add(
    "sidebar-open"
  );

  els.sidebarOverlay.setAttribute(
    "aria-hidden",
    "false"
  );

  requestAnimationFrame(
    () => {
      els.sidebarClose.focus({
        preventScroll:
          true
      });
    }
  );
}

function closeSidebar() {
  document.body.classList.remove(
    "sidebar-open"
  );

  els.sidebarOverlay.setAttribute(
    "aria-hidden",
    "true"
  );

  if (
    window.innerWidth <=
    1000
  ) {
    requestAnimationFrame(
      () => {
        els.hamburger.focus({
          preventScroll:
            true
        });
      }
    );
  }
}

els.hamburger.addEventListener(
  "click",
  openSidebar
);

els.sidebarClose.addEventListener(
  "click",
  closeSidebar
);

els.sidebarOverlay.addEventListener(
  "click",
  closeSidebar
);

/* ============================================================
   DATE / DAY
============================================================ */

function nextDateForDayKey(
  referenceISO,
  wantedDay
) {
  const reference =
    dateFromISO(
      referenceISO
    );

  let current =
    reference.getDay();

  if (
    current === 0
  ) {
    current = 1;
  }

  const wanted =
    DAY_KEYS.indexOf(
      wantedDay
    ) + 1;

  let difference =
    wanted -
    current;

  const result =
    new Date(
      reference
    );

  result.setDate(
    result.getDate() +
      difference
  );

  return toISODate(
    result
  );
}

function selectedDateForApp() {
  return nextDateForDayKey(
    todayISO(),
    app.selectedDay
  );
}

/* ============================================================
   CALENDAR STATE
============================================================ */

function getCalendarState(
  date
) {
  if (
    isSunday(date)
  ) {
    return "holiday";
  }

  return (
    state.calendarStates[
      date
    ] ||
    "default"
  );
}

function isDateHoliday(
  date
) {
  return (
    getCalendarState(
      date
    ) ===
    "holiday"
  );
}

function isDatePresent(
  date
) {
  return (
    getCalendarState(
      date
    ) ===
    "present"
  );
}

/* ============================================================
   TIMETABLE
============================================================ */

function getDaySlots(
  day
) {
  return (
    state.timetable[
      day
    ] ||
    []
  );
}

function slotKey(
  date,
  slot
) {
  return [
    date,
    slot.start,
    slot.end,
    slot.code
  ].join("|");
}

function subjectLabel(
  code
) {
  return (
    state.subjectNames[
      code
    ] ||
    code
  );
}

/* ============================================================
   SLOT STATUS
============================================================ */

function getSlotStatus(
  date,
  slot
) {
  if (
    isDateHoliday(
      date
    )
  ) {
    return "holiday";
  }

  const key =
    slotKey(
      date,
      slot
    );

  const saved =
    state.marks[
      key
    ];

  if (
    saved ===
      "present" ||
    saved ===
      "absent"
  ) {
    return saved;
  }

  if (
    date <
    todayISO()
  ) {
    return "past";
  }

  if (
    date >
    todayISO()
  ) {
    return "upcoming";
  }

  const now =
    currentMinutes();

  const start =
    timeToMinutes(
      slot.start
    );

  const end =
    timeToMinutes(
      slot.end
    );

  if (
    now <
    start
  ) {
    return "upcoming";
  }

  if (
    now >=
    end
  ) {
    return "past";
  }

  return "live";
}

/* ============================================================
   SUMMARY
============================================================ */

function renderSummary() {
  els.targetAttendanceValue.textContent =
    `${state.target}%`;

  els.targetInline.textContent =
    `${state.target}%`;

  els.termStartValue.textContent =
    formatDate(
      state.termStart,
      {
        day:
          "numeric",

        month:
          "short",

        year:
          "numeric"
      }
    );

  els.termStartLabel.textContent =
    formatDate(
      state.termStart,
      {
        day:
          "numeric",

        month:
          "short",

        year:
          "numeric"
      }
    );
}

/* ============================================================
   DAY SELECTOR
============================================================ */

function renderDaySelector() {
  const today =
    todayISO();

  els.daySelector.innerHTML =
    DAY_KEYS
      .map(
        day => {
          const active =
            day ===
            app.selectedDay;

          const date =
            nextDateForDayKey(
              today,
              day
            );

          const holiday =
            isDateHoliday(
              date
            );

          return `
            <button
              type="button"
              role="tab"
              class="day-pill ${
                active
                  ? "active"
                  : ""
              }"
              data-day="${day}"
              aria-selected="${active}"
            >
              ${day}
              ${
                holiday
                  ? " 🏖️"
                  : ""
              }
            </button>
          `;
        }
      )
      .join("");

  $$(".day-pill")
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            app.selectedDay =
              button.dataset
                .day;

            renderMain(
              true
            );
          }
        );
      }
    );
}

/* ============================================================
   TIMELINE
============================================================ */

function renderTimeline(
  date,
  shouldScroll
) {
  const slots =
    getDaySlots(
      getDateDayKey(
        date
      )
    );

  if (
    !slots.length
  ) {
    els.timeline.innerHTML = `
      <div
        class="empty-state"
        style="grid-column:1/-1;"
      >
        <div class="empty-icon">
          🗓️
        </div>

        <h3>
          No classes scheduled
        </h3>

        <p>
          This day currently has no timetable entries.
        </p>
      </div>
    `;

    return;
  }

  els.timeline.innerHTML =
    slots
      .map(
        (
          slot,
          index
        ) => {
          const status =
            getSlotStatus(
              date,
              slot
            );

          let label =
            "Past";

          if (
            status ===
            "live"
          ) {
            label =
              "LIVE NOW";
          }
          else if (
            status ===
            "upcoming"
          ) {
            label =
              "Upcoming";
          }
          else if (
            status ===
            "present"
          ) {
            label =
              "✓ Present";
          }
          else if (
            status ===
            "absent"
          ) {
            label =
              "✖ Absent";
          }

          const visualClass =
            status ===
            "present"
              ? "present"
              : status ===
                "absent"
                ? "past"
                : status;

          return `
            <article
              class="class-card ${visualClass}"
              data-slot-index="${index}"
            >

              <div
                class="status-bar"
              ></div>

              <div
                class="class-time"
              >
                ${escapeHTML(
                  slot.start
                )}
                –
                ${escapeHTML(
                  slot.end
                )}
              </div>

              <div
                class="class-subject"
              >
                ${escapeHTML(
                  subjectLabel(
                    slot.code
                  )
                )}
              </div>

              <div
                class="class-code"
              >
                ${escapeHTML(
                  slot.code
                )}
              </div>

              <div
                class="class-status"
              >

                ${
                  status ===
                  "live"
                    ? `
                      <span
                        class="live-dot"
                      ></span>
                    `
                    : ""
                }

                ${label}

              </div>

            </article>
          `;
        }
      )
      .join("");

  if (
    shouldScroll &&
    date ===
      todayISO()
  ) {
    requestAnimationFrame(
      () => {
        const live =
          els.timeline.querySelector(
            ".class-card.live"
          );

        if (
          live
        ) {
          setTimeout(
            () => {
              live.scrollIntoView(
                {
                  behavior:
                    "smooth",

                  block:
                    "nearest",

                  inline:
                    "center"
                }
              );
            },
            100
          );
        }
      }
    );
  }
}

/* ============================================================
   LIVE PROMPT
============================================================ */

function renderLivePrompt(
  date
) {
  els.livePromptContainer.innerHTML =
    "";

  if (
    date !==
      todayISO() ||
    isDateHoliday(
      date
    ) ||
    isDatePresent(
      date
    )
  ) {
    return;
  }

  const slots =
    getDaySlots(
      getDateDayKey(
        date
      )
    );

  const now =
    currentMinutes();

  const liveSlot =
    slots.find(
      slot =>
        now >=
          timeToMinutes(
            slot.start
          ) &&
        now <
          timeToMinutes(
            slot.end
          )
    );

  if (
    !liveSlot
  ) {
    return;
  }

  const key =
    slotKey(
      date,
      liveSlot
    );

  if (
    state.marks[
      key
    ]
  ) {
    return;
  }

  const prompt =
    document.createElement(
      "div"
    );

  prompt.className =
    "live-prompt";

  prompt.innerHTML = `
    <div
      class="live-prompt-top"
    >

      <span
        class="live-badge"
      >
        <span
          class="live-dot"
        ></span>

        LIVE NOW
      </span>

      <span
        class="live-time"
      >
        ${liveSlot.start}
        –
        ${liveSlot.end}
      </span>

    </div>

    <div
      class="live-course-name"
    >
      ${escapeHTML(
        subjectLabel(
          liveSlot.code
        )
      )}
    </div>

    <div
      class="live-time"
    >
      ${escapeHTML(
        liveSlot.code
      )}
    </div>

    <div
      class="live-buttons"
    >

      <button
        type="button"
        class="live-choice present-choice"
        data-live-choice="present"
      >
        ✓ PRESENT
      </button>

      <button
        type="button"
        class="live-choice absent-choice"
        data-live-choice="absent"
      >
        ✖ ABSENT
      </button>

    </div>
  `;

  els.livePromptContainer.appendChild(
    prompt
  );

  prompt
    .querySelectorAll(
      "[data-live-choice]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            markSlot(
              date,
              liveSlot,
              button.dataset
                .liveChoice
            );
          }
        );
      }
    );
}

/* ============================================================
   SELECTED DAY
============================================================ */

function renderSelectedDay(
  shouldScroll
) {
  const date =
    nextDateForDayKey(
      todayISO(),
      app.selectedDay
    );

  els.selectedDayDate.textContent =
    formatFullDate(
      date
    );

  const holiday =
    isDateHoliday(
      date
    );

  els.holidayBanner.classList.toggle(
    "hidden",
    !holiday
  );

  els.timelineSection.classList.toggle(
    "hidden",
    holiday
  );

  if (
    holiday
  ) {
    els.timeline.innerHTML =
      "";

    els.livePromptContainer.innerHTML =
      "";

    return;
  }

  renderTimeline(
    date,
    shouldScroll
  );

  renderLivePrompt(
    date
  );
}

/* ============================================================
   ATTENDANCE ENGINE
============================================================ */

function calculateBaseAttendance() {
  const result =
    {};

  const start =
    dateFromISO(
      state.termStart
    );

  const end =
    dateFromISO(
      todayISO()
    );

  for (
    let cursor =
      new Date(
        start
      );

    cursor <=
      end;

    cursor.setDate(
      cursor.getDate() +
        1
    )
  ) {
    const date =
      toISODate(
        cursor
      );

    if (
      isSunday(
        date
      )
    ) {
      continue;
    }

    if (
      isDateHoliday(
        date
      )
    ) {
      continue;
    }

    const day =
      getDateDayKey(
        date
      );

    const slots =
      getDaySlots(
        day
      );

    if (
      !slots.length
    ) {
      continue;
    }

    const fullPresent =
      isDatePresent(
        date
      );

    for (
      const slot of
        slots
    ) {
      if (
        !result[
          slot.code
        ]
      ) {
        result[
          slot.code
        ] = {
          present:
            0,

          absent:
            0,

          total:
            0
        };
      }

      let counted =
        false;

      let present =
        false;

      if (
        fullPresent
      ) {
        counted =
          true;

        present =
          true;
      }
      else if (
        date <
        todayISO()
      ) {
        counted =
          true;

        present =
          state.marks[
            slotKey(
              date,
              slot
            )
          ] ===
          "present";
      }
      else if (
        date ===
        todayISO()
      ) {
        const status =
          getSlotStatus(
            date,
            slot
          );

        if (
          status ===
          "present"
        ) {
          counted =
            true;

          present =
            true;
        }
        else if (
          status ===
          "absent"
        ) {
          counted =
            true;

          present =
            false;
        }
        else if (
          currentMinutes() >=
          timeToMinutes(
            slot.end
          )
        ) {
          counted =
            true;

          present =
            false;
        }
      }

      if (
        counted
      ) {
        result[
          slot.code
        ].total++;

        if (
          present
        ) {
          result[
            slot.code
          ].present++;
        }
        else {
          result[
            slot.code
          ].absent++;
        }
      }
    }
  }

  return result;
}

/* ============================================================
   COURSE STATS
============================================================ */

function getCourseStats(
  code
) {
  const base =
    calculateBaseAttendance()[
      code
    ] || {
      present:
        0,

      absent:
        0,

      total:
        0
    };

  const adjustment =
    state.adjustments[
      code
    ] || {
      present:
        0,

      absent:
        0,

      total:
        0
    };

  let present =
    base.present +
    Number(
      adjustment.present ||
        0
    );

  let absent =
    base.absent +
    Number(
      adjustment.absent ||
        0
    );

  let total =
    base.total +
    Number(
      adjustment.total ||
        0
    );

  present =
    Math.max(
      0,
      Math.round(
        present
      )
    );

  absent =
    Math.max(
      0,
      Math.round(
        absent
      )
    );

  total =
    Math.max(
      0,
      Math.round(
        total
      )
    );

  /*
   * Never allow impossible states.
   */
  if (
    present >
    total
  ) {
    present =
      total;
  }

  if (
    present +
      absent >
    total
  ) {
    absent =
      Math.max(
        0,
        total -
          present
      );
  }

  /*
   * Ensure total always contains all displayed classes.
   */
  if (
    present +
      absent <
    total
  ) {
    absent =
      total -
      present;
  }

  return {
    present,
    absent,
    total
  };
}

/* ============================================================
   COURSE CODES
============================================================ */

function getAllCourseCodes() {
  const codes =
    new Set();

  DAY_KEYS.forEach(
    day => {
      getDaySlots(
        day
      ).forEach(
        slot => {
          codes.add(
            slot.code
          );
        }
      );
    }
  );

  Object.keys(
    state.subjectNames ||
      {}
  ).forEach(
    code => {
      codes.add(
        code
      );
    }
  );

  Object.keys(
    state.adjustments ||
      {}
  ).forEach(
    code => {
      codes.add(
        code
      );
    }
  );

  return Array.from(
    codes
  ).sort(
    (a, b) =>
      subjectLabel(
        a
      ).localeCompare(
        subjectLabel(
          b
        )
      )
  );
}

/* ============================================================
   BUNK METER
============================================================ */

function calculateBunkMessage(
  present,
  total
) {
  if (
    total ===
    0
  ) {
    return {
      type:
        "safe",

      text:
        "No classes tracked yet"
    };
  }

  const target =
    state.target /
    100;

  const percentage =
    present /
    total;

  if (
    percentage >=
    target
  ) {
    if (
      target >=
      1
    ) {
      return {
        type:
          "safe",

        text:
          "Target is 100%"
      };
    }

    const possible =
      Math.floor(
        (
          present /
          target
        ) -
        total +
        1e-10
      );

    return {
      type:
        "safe",

      text:
        possible ===
        1
          ? "Safe to bunk 1 class"
          : `Safe to bunk ${Math.max(
              0,
              possible
            )} classes`
    };
  }

  if (
    target >=
    1
  ) {
    return {
      type:
        "danger",

      text:
        "Attend every next class"
    };
  }

  const required =
    Math.ceil(
      (
        target *
          total -
        present
      ) /
      (1 -
        target) -
      1e-10
    );

  return {
    type:
      "danger",

    text:
      Math.max(
        0,
        required
      ) === 1
        ? "Attend next 1 class"
        : `Attend next ${Math.max(
            0,
            required
          )} classes`
  };
}

/* ============================================================
   COURSE CARD
============================================================ */

function renderCourseCard(
  code
) {
  const stats =
    getCourseStats(
      code
    );

  const percentage =
    stats.total ===
    0
      ? 0
      : (
          stats.present /
          stats.total
        ) * 100;

  const bounded =
    clamp(
      percentage,
      0,
      100
    );

  const colour =
    bounded >=
    state.target
      ? "var(--green)"
      : "var(--red)";

  const bunk =
    calculateBunkMessage(
      stats.present,
      stats.total
    );

  const circumference =
    2 *
    Math.PI *
    33;

  const offset =
    circumference *
    (
      1 -
      bounded /
        100
    );

  const open =
    app.openCourse ===
    code;

  const activeHoliday =
    isDateHoliday(
      selectedDateForApp()
    );

  return `
    <article
      class="course-card ${
        open
          ? "open"
          : ""
      }"
      data-course-card="${escapeAttribute(
        code
      )}"
    >

      <div
        class="course-main"
      >

        <div
          class="course-top"
        >

          <div
            class="progress-wrap"
          >

            <svg
              class="progress-svg"
              viewBox="0 0 76 76"
            >

              <circle
                class="progress-bg"
                cx="38"
                cy="38"
                r="33"
              ></circle>

              <circle
                class="progress-value"
                cx="38"
                cy="38"
                r="33"
                style="
                  stroke:${colour};
                  stroke-dasharray:${circumference};
                  stroke-dashoffset:${offset};
                "
              ></circle>

            </svg>

            <div
              class="progress-center"
            >

              <div>

                <div
                  class="progress-number"
                  style="color:${colour}"
                >
                  ${Math.round(
                    bounded
                  )}
                </div>

                <div
                  class="progress-percent"
                >
                  %
                </div>

              </div>

            </div>

          </div>

          <div>

            <div
              class="course-name"
            >
              ${escapeHTML(
                subjectLabel(
                  code
                )
              )}
            </div>

            <div
              class="course-code"
            >
              ${escapeHTML(
                code
              )}
            </div>

            <div
              class="course-total"
            >
              ${stats.total}
              total •
              ${stats.present}
              present •
              ${stats.absent}
              absent
            </div>

          </div>

        </div>

        <div
          class="bunk-meter ${
            bunk.type ===
            "safe"
              ? "bunk-safe"
              : "bunk-danger"
          }"
        >
          ${escapeHTML(
            bunk.text
          )}
        </div>

      </div>

      <div
        class="course-drawer"
      >

        <div
          class="drawer-inner"
        >

          ${
            activeHoliday
              ? `
                <div
                  class="manual-lock"
                >
                  Manual actions are locked on holidays.
                </div>
              `
              : `
                <button
                  type="button"
                  class="manual-btn manual-present"
                  data-manual-present="${escapeAttribute(
                    code
                  )}"
                >
                  ✓ PRESENT
                </button>

                <button
                  type="button"
                  class="manual-btn manual-absent"
                  data-manual-absent="${escapeAttribute(
                    code
                  )}"
                >
                  ✖ ABSENT
                </button>
              `
          }

        </div>

      </div>

    </article>
  `;
}

/* ============================================================
   DASHBOARD
============================================================ */

function renderCourseDashboard() {
  const codes =
    getAllCourseCodes();

  if (
    !codes.length
  ) {
    els.courseGrid.innerHTML =
      "";

    els.emptyState.classList.remove(
      "hidden"
    );

    return;
  }

  els.emptyState.classList.add(
    "hidden"
  );

  els.courseGrid.innerHTML =
    codes
      .map(
        code =>
          renderCourseCard(
            code
          )
      )
      .join("");

  wireCourseCards();
}

function wireCourseCards() {
  $$(".course-main")
    .forEach(
      main => {
        main.addEventListener(
          "click",
          () => {
            const card =
              main.closest(
                ".course-card"
              );

            const code =
              card.dataset
                .courseCard;

            app.openCourse =
              app.openCourse ===
              code
                ? null
                : code;

            renderCourseDashboard();
          }
        );
      }
    );

  $$(
    "[data-manual-present]"
  ).forEach(
    button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          adjustCourse(
            button.dataset
              .manualPresent,
            "present"
          );
        }
      );
    }
  );

  $$(
    "[data-manual-absent]"
  ).forEach(
    button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          adjustCourse(
            button.dataset
              .manualAbsent,
            "absent"
          );
        }
      );
    }
  );
}

/* ============================================================
   MANUAL ADJUSTMENT
============================================================ */

function adjustCourse(
  code,
  type
) {
  if (
    isDateHoliday(
      selectedDateForApp()
    )
  ) {
    return;
  }

  if (
    !state.adjustments[
      code
    ]
  ) {
    state.adjustments[
      code
    ] = {
      present:
        0,

      absent:
        0,

      total:
        0
    };
  }

  if (
    type ===
    "present"
  ) {
    state.adjustments[
      code
    ].present++;
  }
  else {
    state.adjustments[
      code
    ].absent++;
  }

  addHistory({
    type,
    course:
      code,

    date:
      todayISO(),

    detail:
      type ===
      "present"
        ? "Manual present added"
        : "Manual absent added"
  });

  persistState();

  renderMain(false);
}

/* ============================================================
   MARK SLOT
============================================================ */

function markSlot(
  date,
  slot,
  choice
) {
  if (
    isDateHoliday(
      date
    )
  ) {
    return;
  }

  state.marks[
    slotKey(
      date,
      slot
    )
  ] =
    choice;

  addHistory({
    type:
      choice,

    course:
      slot.code,

    date:
      date,

    detail:
      choice ===
      "present"
        ? `Marked ${slot.start}–${slot.end} present`
        : `Marked ${slot.start}–${slot.end} absent`
  });

  maybeAutoPresentDay(
    date
  );

  persistState();

  renderMain(false);
}

/* ============================================================
   AUTO PRESENT DAY
============================================================ */

function maybeAutoPresentDay(
  date
) {
  if (
    date !==
    todayISO()
  ) {
    return;
  }

  if (
    isSunday(
      date
    ) ||
    isDateHoliday(
      date
    )
  ) {
    return;
  }

  const slots =
    getDaySlots(
      getDateDayKey(
        date
      )
    );

  if (
    !slots.length
  ) {
    return;
  }

  const allPresent =
    slots.every(
      slot =>
        state.marks[
          slotKey(
            date,
            slot
          )
        ] ===
        "present"
    );

  const anyAbsent =
    slots.some(
      slot =>
        state.marks[
          slotKey(
            date,
            slot
          )
        ] ===
        "absent"
    );

  if (
    allPresent &&
    !anyAbsent
  ) {
    /*
     * Full-day Present becomes the source of truth.
     * Individual slot records are not separately counted,
     * avoiding double-counting.
     */
    state.calendarStates[
      date
    ] =
      "present";
  }
}

/* ============================================================
   MAIN RENDER
============================================================ */

function renderMain(
  shouldScroll = false
) {
  renderSummary();

  renderDaySelector();

  renderSelectedDay(
    shouldScroll
  );

  renderCourseDashboard();
}

/* ============================================================
   MODALS
============================================================ */

function openModal({
  title,
  subtitle = "",
  html,
  className = ""
}) {
  els.modalTitle.textContent =
    title;

  els.modalSubtitle.textContent =
    subtitle;

  els.modalBody.innerHTML =
    html;

  els.modalBody.className =
    `modal-body touch-trap ${className}`;

  els.modalBackdrop.classList.remove(
    "hidden"
  );

  els.modalBackdrop.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "modal-open"
  );

  els.modalBody.dataset
    .scrollTrapInstalled =
    "false";

  installOnePixelScrollTrap(
    els.modalBody
  );
}

function closeModal() {
  if (
    typeof app.modalCloseHandler ===
    "function"
  ) {
    app.modalCloseHandler();
  }

  app.modalCloseHandler =
    null;

  els.modalBackdrop.classList.add(
    "hidden"
  );

  els.modalBackdrop.setAttribute(
    "aria-hidden",
    "true"
  );

  els.modalBody.innerHTML =
    "";

  document.body.classList.remove(
    "modal-open"
  );
}

els.modalClose.addEventListener(
  "click",
  closeModal
);

els.modalBackdrop.addEventListener(
  "click",
  event => {
    if (
      event.target ===
      els.modalBackdrop
    ) {
      closeModal();
    }
  }
);

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key ===
        "Escape" &&
      !els.modalBackdrop.classList.contains(
        "hidden"
      )
    ) {
      closeModal();
    }
  }
);

/* ============================================================
   NAVIGATION
============================================================ */

const navigationActions = {
  howToUse:
    openHowToUse,

  customTimetable:
    openTimetableBuilder,

  history:
    openHistory,

  calendar:
    openCalendar,

  target:
    openTargetModal,

  editAttendance:
    openEditAttendance,

  addCourse:
    openAddCourse,

  removeCourse:
    openRemoveCourse,

  resetTimetable:
    resetDefaultTimetable
};

$$(".nav-item")
  .forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          closeSidebar();

          const action =
            button.dataset
              .action;

          if (
            navigationActions[
              action
            ]
          ) {
            navigationActions[
              action
            ]();
          }
        }
      );
    }
  );

$("#termStartButton")
  .addEventListener(
    "click",
    openTermDateModal
  );

/* ============================================================
   HOW TO USE
============================================================ */

function openHowToUse() {
  openModal({
    title:
      "How to Use",

    subtitle:
      "Attendance Tracker guide",

    html: `
      <div
        class="help-content"
      >

        <div class="help-step">
          <div class="help-number">1</div>

          <div>
            <h3>
              Set the term start
            </h3>

            <p>
              Attendance is calculated from the term start
              date through today.
            </p>
          </div>
        </div>

        <div class="help-step">
          <div class="help-number">2</div>

          <div>
            <h3>
              Configure your timetable
            </h3>

            <p>
              Use the timetable builder to change the complete
              Monday–Saturday schedule.
            </p>
          </div>
        </div>

        <div class="help-step">
          <div class="help-number">3</div>

          <div>
            <h3>
              Mark live classes
            </h3>

            <p>
              When a class is currently running, the LIVE NOW
              prompt provides PRESENT and ABSENT buttons.
            </p>
          </div>
        </div>

        <div class="help-step">
          <div class="help-number">4</div>

          <div>
            <h3>
              Past classes
            </h3>

            <p>
              Past scheduled classes are automatically counted
              absent unless explicitly marked present.
            </p>
          </div>
        </div>

        <div class="help-step">
          <div class="help-number">5</div>

          <div>
            <h3>
              Calendar
            </h3>

            <p>
              Paint dates as Holiday, Important or Present.
              Sundays are always holidays.
            </p>
          </div>
        </div>

        <div class="help-step">
          <div class="help-number">6</div>

          <div>
            <h3>
              Bunk Meter
            </h3>

            <p>
              The meter calculates the number of classes you
              can safely miss or the number you need to attend.
            </p>
          </div>
        </div>

      </div>
    `
  });
}

/* ============================================================
   TARGET
============================================================ */

function openTargetModal() {
  openModal({
    title:
      "Set Target Attendance",

    subtitle:
      "Used by the Bunk Meter",

    html: `
      <div
        class="form-group"
      >

        <label
          class="form-label"
          for="targetInput"
        >
          Target attendance (%)
        </label>

        <input
          id="targetInput"
          class="input"
          type="number"
          min="1"
          max="100"
          step="0.1"
          value="${state.target}"
        >

      </div>

      <div class="form-actions">

        <button
          id="saveTarget"
          class="btn btn-primary"
          type="button"
        >
          Save Target
        </button>

      </div>
    `
  });

  $("#saveTarget")
    .addEventListener(
      "click",
      () => {
        let value =
          Number(
            $("#targetInput")
              .value
          );

        if (
          !Number.isFinite(
            value
          )
        ) {
          value =
            75;
        }

        state.target =
          Math.round(
            clamp(
              value,
              1,
              100
            ) * 10
          ) /
          10;

        persistState();

        closeModal();

        renderMain(false);
      }
    );
}

/* ============================================================
   TERM DATE
============================================================ */

function openTermDateModal() {
  openModal({
    title:
      "Set Term Start Date",

    subtitle:
      "Attendance starts being calculated from this date.",

    html: `
      <div class="notice">
        Past scheduled classes are calculated automatically
        from this date.
      </div>

      <div
        class="form-group"
      >

        <label
          class="form-label"
          for="termDateInput"
        >
          Term Start Date
        </label>

        <input
          id="termDateInput"
          class="input"
          type="date"
          value="${state.termStart}"
        >

      </div>

      <div class="form-actions">

        <button
          id="saveTermDate"
          class="btn btn-primary"
          type="button"
        >
          Save Date
        </button>

      </div>
    `
  });

  $("#saveTermDate")
    .addEventListener(
      "click",
      () => {
        const value =
          $("#termDateInput")
            .value;

        if (!value) {
          return;
        }

        if (
          value >
          todayISO()
        ) {
          alert(
            "Term start date cannot be in the future."
          );

          return;
        }

        state.termStart =
          value;

        persistState();

        closeModal();

        renderMain(false);
      }
    );
}

/* ============================================================
   EDIT ATTENDANCE
============================================================ */

function openEditAttendance() {
  const codes =
    getAllCourseCodes();

  openModal({
    title:
      "Edit Attendance",

    subtitle:
      "Values are protected from negative or impossible states.",

    html: `
      <div class="notice">
        Present can never exceed Total. Present, Absent and Total
        can never become negative.
      </div>

      <div class="history-list">

        ${
          codes.length
            ? codes
                .map(
                  code => {
                    const stats =
                      getCourseStats(
                        code
                      );

                    return `
                      <div
                        class="history-item"
                      >

                        <div
                          class="history-dot"
                          style="
                            background:
                            var(--primary)
                          "
                        ></div>

                        <div>

                          <div
                            class="history-title"
                          >
                            ${escapeHTML(
                              subjectLabel(
                                code
                              )
                            )}
                          </div>

                          <div
                            class="history-sub"
                          >
                            ${escapeHTML(
                              code
                            )}

                            •
                            ${stats.present}
                            /
                            ${stats.total}
                          </div>

                        </div>

                        <button
                          type="button"
                          class="btn btn-muted"
                          data-edit-course="${escapeAttribute(
                            code
                          )}"
                        >
                          Edit
                        </button>

                      </div>
                    `;
                  }
                )
                .join("")
            : `
              <div class="notice">
                No courses found.
              </div>
            `
        }

      </div>
    `
  });

  $$(
    "[data-edit-course]"
  ).forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          showCourseAttendanceEditor(
            button.dataset
              .editCourse
          );
        }
      );
    }
  );
}

function showCourseAttendanceEditor(
  code
) {
  const base =
    calculateBaseAttendance()[
      code
    ] || {
      present:
        0,

      absent:
        0,

      total:
        0
    };

  const current =
    getCourseStats(
      code
    );

  openModal({
    title:
      `Edit ${subjectLabel(
        code
      )}`,

    subtitle:
      code,

    html: `
      <div class="notice">

        Automatic baseline:
        <strong>
          ${base.present}/${base.total}
        </strong>

        <br>

        Current:
        <strong>
          ${current.present}/${current.total}
        </strong>

      </div>

      <div
        class="form-grid"
      >

        <div class="form-group">

          <label
            class="form-label"
            for="manualPresent"
          >
            Present
          </label>

          <input
            id="manualPresent"
            class="input"
            type="number"
            min="0"
            step="1"
            value="${current.present}"
          >

        </div>

        <div class="form-group">

          <label
            class="form-label"
            for="manualTotal"
          >
            Total
          </label>

          <input
            id="manualTotal"
            class="input"
            type="number"
            min="0"
            step="1"
            value="${current.total}"
          >

        </div>

      </div>

      <div class="form-actions">

        <button
          id="saveManualAttendance"
          class="btn btn-primary"
          type="button"
        >
          Save
        </button>

        <button
          id="cancelManualAttendance"
          class="btn btn-muted"
          type="button"
        >
          Cancel
        </button>

      </div>
    `
  });

  $("#cancelManualAttendance")
    .addEventListener(
      "click",
      openEditAttendance
    );

  $("#saveManualAttendance")
    .addEventListener(
      "click",
      () => {
        const requestedTotal =
          Math.floor(
            Number(
              $("#manualTotal")
                .value
            ) || 0
          );

        const requestedPresent =
          Math.floor(
            Number(
              $("#manualPresent")
                .value
            ) || 0
          );

        const total =
          Math.max(
            0,
            requestedTotal
          );

        const present =
          Math.min(
            total,
            Math.max(
              0,
              requestedPresent
            )
          );

        const absent =
          Math.max(
            0,
            total -
              present
          );

        state.adjustments[
          code
        ] = {
          present:
            present -
            base.present,

          absent:
            absent -
            base.absent,

          total:
            total -
            base.total
        };

        addHistory({
          type:
            "info",

          course:
            code,

          date:
            todayISO(),

          detail:
            `Attendance set to ${present}/${total}`
        });

        persistState();

        closeModal();

        renderMain(false);
      }
    );
}

/* ============================================================
   ADD COURSE
============================================================ */

function openAddCourse() {
  openModal({
    title:
      "Add Custom Course",

    subtitle:
      "Add a new course name and subject code.",

    html: `
      <div class="form-grid">

        <div class="form-group">

          <label
            class="form-label"
            for="newCourseCode"
          >
            Subject Code
          </label>

          <input
            id="newCourseCode"
            class="input"
            type="text"
            placeholder="25AI101"
          >

        </div>

        <div class="form-group">

          <label
            class="form-label"
            for="newCourseName"
          >
            Full Subject Name
          </label>

          <input
            id="newCourseName"
            class="input"
            type="text"
            placeholder="Artificial Intelligence"
          >

        </div>

      </div>

      <div class="form-actions">

        <button
          id="saveCustomCourse"
          class="btn btn-primary"
          type="button"
        >
          Add Course
        </button>

      </div>
    `
  });

  $("#saveCustomCourse")
    .addEventListener(
      "click",
      () => {
        const code =
          $("#newCourseCode")
            .value
            .trim()
            .toUpperCase();

        const name =
          $("#newCourseName")
            .value
            .trim();

        if (
          !code ||
          !name
        ) {
          alert(
            "Enter both the subject code and full subject name."
          );

          return;
        }

        state.subjectNames[
          code
        ] =
          name;

        if (
          !state.adjustments[
            code
          ]
        ) {
          state.adjustments[
            code
          ] = {
            present:
              0,

            absent:
              0,

            total:
              0
          };
        }

        addHistory({
          type:
            "info",

          course:
            code,

          date:
            todayISO(),

          detail:
            `Added course: ${name}`
        });

        persistState();

        closeModal();

        renderMain(false);
      }
    );
}

/* ============================================================
   REMOVE COURSE
============================================================ */

function openRemoveCourse() {
  const codes =
    getAllCourseCodes();

  openModal({
    title:
      "Remove Course",

    subtitle:
      "Remove a course from the timetable.",

    html: `
      <div
        class="history-list"
      >

        ${
          codes.length
            ? codes
                .map(
                  code => `
                    <div
                      class="history-item"
                    >

                      <div
                        class="history-dot"
                        style="
                          background:
                          var(--red)
                        "
                      ></div>

                      <div>

                        <div
                          class="history-title"
                        >
                          ${escapeHTML(
                            subjectLabel(
                              code
                            )
                          )}
                        </div>

                        <div
                          class="history-sub"
                        >
                          ${escapeHTML(
                            code
                          )}
                        </div>

                      </div>

                      <button
                        type="button"
                        class="btn btn-red"
                        data-remove-course="${escapeAttribute(
                          code
                        )}"
                      >
                        Remove
                      </button>

                    </div>
                  `
                )
                .join("")
            : `
              <div class="notice">
                No courses available.
              </div>
            `
        }

      </div>
    `
  });

  $$(
    "[data-remove-course]"
  ).forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          removeCourse(
            button.dataset
              .removeCourse
          );
        }
      );
    }
  );
}

function removeCourse(
  code
) {
  if (
    !confirm(
      `Remove "${subjectLabel(
        code
      )}" from the timetable?`
    )
  ) {
    return;
  }

  DAY_KEYS.forEach(
    day => {
      state.timetable[
        day
      ] =
        getDaySlots(
          day
        ).filter(
          slot =>
            slot.code !==
            code
        );
    }
  );

  delete state.subjectNames[
    code
  ];

  delete state.adjustments[
    code
  ];

  addHistory({
    type:
      "info",

    course:
      code,

    date:
      todayISO(),

    detail:
      "Course removed"
  });

  persistState();

  app.openCourse =
    null;

  closeModal();

  renderMain(false);
}

/* ============================================================
   RESET TIMETABLE
============================================================ */

function resetDefaultTimetable() {
  if (
    !confirm(
      "Reset the timetable to the exact default schedule?"
    )
  ) {
    return;
  }

  state.timetable =
    clone(
      DEFAULT_TIMETABLE
    );

  state.subjectNames = {
    ...state.subjectNames,
    ...DEFAULT_SUBJECT_NAMES
  };

  addHistory({
    type:
      "info",

    date:
      todayISO(),

    detail:
      "Default timetable restored"
  });

  persistState();

  renderMain(false);
}

/* ============================================================
   TIMETABLE BUILDER
============================================================ */

function openTimetableBuilder() {
  const startingDay =
    DAY_KEYS.includes(
      app.selectedDay
    )
      ? app.selectedDay
      : "Mon";

  let currentDay =
    startingDay;

  function openBuilder() {
    openModal({
      title:
        "Create Custom Timetable",

      subtitle:
        "Saving replaces the timetable.",

      html:
        renderBuilderHTML(
          currentDay
        )
    });

    wireBuilder();
  }

  function readRows() {
    return $$("#periodList .period-row")
      .map(
        row => ({
          start:
            row.querySelector(
              ".period-start"
            ).value,

          end:
            row.querySelector(
              ".period-end"
            ).value,

          code:
            row.querySelector(
              ".period-code"
            ).value
              .trim()
              .toUpperCase()
        })
      );
  }

  function saveCurrentDay() {
    const rows =
      readRows();

    rows.forEach(
      row => {
        if (
          !row.start ||
          !row.end ||
          !row.code
        ) {
          throw new Error(
            "Every period must have a start time, end time and subject code."
          );
        }

        if (
          timeToMinutes(
            row.end
          ) <=
          timeToMinutes(
            row.start
          )
        ) {
          throw new Error(
            `End time must be later than start time for ${row.code}.`
          );
        }
      }
    );

    state.timetable[
      currentDay
    ] =
      rows.sort(
        (a, b) =>
          timeToMinutes(
            a.start
          ) -
          timeToMinutes(
            b.start
          )
      );
  }

  function collectCodes() {
    const codes =
      new Set();

    $$("#periodList .period-code")
      .forEach(
        input => {
          const code =
            input.value
              .trim()
              .toUpperCase();

          if (
            code
          ) {
            codes.add(
              code
            );
          }
        }
      );

    DAY_KEYS.forEach(
      day => {
        getDaySlots(
          day
        ).forEach(
          slot => {
            codes.add(
              slot.code
            );
          }
        );
      }
    );

    return Array.from(
      codes
    ).sort();
  }

  function renderMappings() {
    const mapping =
      $("#mappingList");

    if (
      !mapping
    ) {
      return;
    }

    mapping.innerHTML =
      collectCodes()
        .map(
          code => `
            <div
              class="mapping-row"
              data-mapping-code="${escapeAttribute(
                code
              )}"
            >

              <strong
                style="
                  font-size:.72rem;
                "
              >
                ${escapeHTML(
                  code
                )}
              </strong>

              <input
                class="input mapping-name-input"
                type="text"
                value="${escapeAttribute(
                  state.subjectNames[
                    code
                  ] ||
                    code
                )}"
                placeholder="Full subject name"
              >

            </div>
          `
        )
        .join("");
  }

  function wireBuilder() {

    $$(
      "[data-builder-day]"
    ).forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            try {
              saveCurrentDay();
            }
            catch (
              error
            ) {
              alert(
                error.message
              );

              return;
            }

            currentDay =
              button.dataset
                .builderDay;

            els.modalBody.innerHTML =
              renderBuilderHTML(
                currentDay
              );

            els.modalBody.dataset
              .scrollTrapInstalled =
              "false";

            installOnePixelScrollTrap(
              els.modalBody
            );

            wireBuilder();
          }
        );
      }
    );

    $$("#periodList .remove-period-btn")
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () => {
              button
                .closest(
                  ".period-row"
                )
                .remove();

              renderMappings();
            }
          );
        }
      );

    $("#addPeriodBtn")
      .addEventListener(
        "click",
        () => {
          const list =
            $("#periodList");

          const index =
            list.children
              .length;

          list.insertAdjacentHTML(
            "beforeend",
            renderPeriodRow(
              {
                start:
                  "09:00",

                end:
                  "09:55",

                code:
                  ""
              },
              index
            )
          );

          wireBuilder();

          renderMappings();
        }
      );

    $("#saveTimetable")
      .addEventListener(
        "click",
        () => {
          try {
            saveCurrentDay();

            $$(".mapping-row")
              .forEach(
                row => {
                  const code =
                    row.dataset
                      .mappingCode;

                  const input =
                    row.querySelector(
                      ".mapping-name-input"
                    );

                  const name =
                    input.value
                      .trim();

                  if (
                    name
                  ) {
                    state.subjectNames[
                      code
                    ] =
                      name;
                  }
                }
              );

            addHistory({
              type:
                "info",

              date:
                todayISO(),

              detail:
                "Custom timetable saved"
            });

            persistState();

            closeModal();

            renderMain(false);
          }
          catch (
            error
          ) {
            alert(
              error.message
            );
          }
        }
      );

    renderMappings();
  }

  openBuilder();
}

function renderPeriodRow(
  slot,
  index
) {
  return `
    <div
      class="period-row"
      data-period-row="${index}"
    >

      <input
        class="input period-start"
        type="time"
        value="${escapeAttribute(
          slot.start
        )}"
      >

      <input
        class="input period-end"
        type="time"
        value="${escapeAttribute(
          slot.end
        )}"
      >

      <input
        class="input period-code"
        type="text"
        value="${escapeAttribute(
          slot.code
        )}"
        placeholder="Subject code"
      >

      <button
        type="button"
        class="remove-period-btn"
        data-remove-period="${index}"
      >
        ×
      </button>

    </div>
  `;
}

function renderBuilderHTML(
  day
) {
  return `
    <div class="notice">
      Configure each day and map your subject codes to full
      subject names.
    </div>

    <div
      id="builderDayBar"
      class="builder-day-bar"
    >
      ${DAY_KEYS
        .map(
          key => `
            <button
              type="button"
              class="builder-day-btn ${
                key === day
                  ? "active"
                  : ""
              }"
              data-builder-day="${key}"
            >
              ${key}
            </button>
          `
        )
        .join("")}
    </div>

    <div
      id="periodList"
      class="period-list"
    >
      ${getDaySlots(day)
        .map(
          (
            slot,
            index
          ) =>
            renderPeriodRow(
              slot,
              index
            )
        )
        .join("")}
    </div>

    <div class="form-actions">

      <button
        id="addPeriodBtn"
        class="btn btn-muted"
        type="button"
      >
        + Add Period
      </button>

    </div>

    <div
      class="mapping-section"
    >

      <div class="section-heading-row">

        <div>

          <h3
            style="
              margin:0;
              font-size:.9rem;
            "
          >
            Subject Name Mapping
          </h3>

          <p class="muted-text">
            Give each subject code its full display name.
          </p>

        </div>

      </div>

      <div
        id="mappingList"
        class="mapping-list"
      ></div>

    </div>

    <div class="form-actions">

      <button
        id="saveTimetable"
        class="btn btn-primary"
        type="button"
      >
        Save Timetable
      </button>

    </div>
  `;
}

/* ============================================================
   HISTORY
============================================================ */

function addHistory(
  event
) {
  state.history.unshift({
    id:
      `${Date.now()}_${Math.random()}`,

    timestamp:
      new Date().toISOString(),

    type:
      event.type ||
      "info",

    course:
      event.course ||
      "",

    date:
      event.date ||
      "",

    detail:
      event.detail ||
      ""
  });

  state.history =
    state.history.slice(
      0,
      250
    );

  persistState();
}

function formatHistoryTime(
  timestamp
) {
  const date =
    new Date(
      timestamp
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    undefined,
    {
      day:
        "numeric",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit"
    }
  );
}

function openHistory() {
  openModal({
    title:
      "History Log",

    subtitle:
      "Recent activity.",

    html: `
      ${
        state.history.length
          ? `
            <div class="history-list">
              ${state.history
                .map(
                  item => `
                    <div
                      class="history-item"
                    >

                      <div
                        class="history-dot"
                        style="
                          background:
                          ${
                            item.type ===
                            "present"
                              ? "var(--green)"
                              : item.type ===
                                  "absent"
                                ? "var(--red)"
                                : "var(--primary)"
                          }
                        "
                      ></div>

                      <div>

                        <div
                          class="history-title"
                        >
                          ${escapeHTML(
                            item.course
                              ? subjectLabel(
                                  item.course
                                )
                              : "System"
                          )}
                        </div>

                        <div
                          class="history-sub"
                        >
                          ${escapeHTML(
                            item.detail
                          )}

                          ${
                            item.date
                              ? ` • ${escapeHTML(
                                  item.date
                                )}`
                              : ""
                          }
                        </div>

                      </div>

                      <div
                        class="history-time"
                      >
                        ${formatHistoryTime(
                          item.timestamp
                        )}
                      </div>

                    </div>
                  `
                )
                .join("")}
            </div>
          `
          : `
            <div class="notice">
              No history entries yet.
            </div>
          `
      }

      <div class="form-actions">

        <button
          id="clearHistory"
          class="btn btn-red"
          type="button"
        >
          Clear History
        </button>

      </div>
    `
  });

  $("#clearHistory")
    .addEventListener(
      "click",
      () => {
        if (
          confirm(
            "Clear all history?"
          )
        ) {
          state.history =
            [];

          persistState();

          openHistory();
        }
      }
    );
}

/* ============================================================
   CALENDAR
============================================================ */

let calendarObjectURL =
  null;

function openCalendar() {
  app.calendarViewYear =
    new Date().getFullYear();

  openModal({
    title:
      "Academic Calendar",

    subtitle:
      "Paint dates and upload your college calendar.",

    className:
      "calendar-modal",

    html:
      renderCalendarHTML()
  });

  wireCalendar();
}

function renderCalendarHTML() {
  return `
    <div
      class="calendar-split"
    >

      <div
        class="calendar-preview-pane"
      >

        <div
          class="calendar-upload-toolbar"
        >

          <div>

            <strong
              style="
                font-size:.74rem;
              "
            >
              College Calendar
            </strong>

            <div
              id="calendarFileName"
              style="
                font-size:.63rem;
                opacity:.7;
                margin-top:2px;
              "
            >
              ${
                state.calendarUploadedName ||
                "No file selected"
              }
            </div>

          </div>

          <label
            for="calendarFileInput"
            class="btn btn-muted"
            style="cursor:pointer;"
          >
            Upload Image / PDF
          </label>

          <input
            id="calendarFileInput"
            type="file"
            accept="image/*,.pdf,application/pdf"
            hidden
          >

        </div>

        <div
          id="calendarPreview"
          class="calendar-preview"
        >

          <div
            id="calendarPreviewContent"
            class="calendar-preview-content"
          >

            <div
              class="calendar-preview-empty"
            >
              Upload your college calendar here.
              <br><br>
              Pinch with two fingers to zoom.
            </div>

          </div>

        </div>

      </div>

      <div
        class="calendar-grid-pane"
      >

        <div
          class="calendar-controls"
        >

          <button
            id="calendarPrevYear"
            class="btn btn-muted"
            type="button"
          >
            ‹
          </button>

          <div
            id="calendarYearTitle"
            class="calendar-year-title"
          >
            ${app.calendarViewYear}
          </div>

          <button
            id="calendarNextYear"
            class="btn btn-muted"
            type="button"
          >
            ›
          </button>

        </div>

        <div
          class="calendar-legend"
        >

          <span class="legend-item">
            <span
              class="legend-dot"
              style="
                background:var(--red)
              "
            ></span>
            Holiday
          </span>

          <span class="legend-item">
            <span
              class="legend-dot"
              style="
                background:var(--blue)
              "
            ></span>
            Important
          </span>

          <span class="legend-item">
            <span
              class="legend-dot"
              style="
                background:var(--green)
              "
            ></span>
            Present
          </span>

        </div>

        <div
          id="monthGrid"
          class="month-grid"
        ></div>

      </div>

    </div>
  `;
}

function wireCalendar() {
  $("#calendarPrevYear")
    .addEventListener(
      "click",
      () => {
        app.calendarViewYear--;

        renderMonthGrid();
      }
    );

  $("#calendarNextYear")
    .addEventListener(
      "click",
      () => {
        app.calendarViewYear++;

        renderMonthGrid();
      }
    );

  $("#calendarFileInput")
    .addEventListener(
      "change",
      handleCalendarUpload
    );

  renderMonthGrid();

  setupCalendarPinchZoom();
}

function renderMonthGrid() {
  const grid =
    $("#monthGrid");

  if (
    !grid
  ) {
    return;
  }

  $("#calendarYearTitle")
    .textContent =
    app.calendarViewYear;

  let html =
    "";

  for (
    let month = 0;
    month < 12;
    month++
  ) {
    html +=
      renderMonth(
        app.calendarViewYear,
        month
      );
  }

  grid.innerHTML =
    html;

  $$("#monthGrid .calendar-day")
    .forEach(
      button => {
        if (
          button.classList.contains(
            "empty"
          )
        ) {
          return;
        }

        button.addEventListener(
          "click",
          () => {
            cycleCalendarDate(
              button.dataset
                .date
            );
          }
        );
      }
    );
}

function renderMonth(
  year,
  month
) {
  const name =
    new Date(
      year,
      month,
      1
    ).toLocaleString(
      undefined,
      {
        month:
          "long"
      }
    );

  const first =
    new Date(
      year,
      month,
      1
    ).getDay();

  const leading =
    first ===
    0
      ? 6
      : first - 1;

  const numberOfDays =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  let cells =
    "";

  for (
    let i = 0;
    i < leading;
    i++
  ) {
    cells += `
      <div
        class="calendar-day empty"
      ></div>
    `;
  }

  for (
    let day = 1;
    day <=
    numberOfDays;
    day++
  ) {
    const date =
      `${year}-${String(
        month + 1
      ).padStart(
        2,
        "0"
      )}-${String(
        day
      ).padStart(
        2,
        "0"
      )}`;

    const stateValue =
      getCalendarState(
        date
      );

    const classes = [
      "calendar-day",

      isSunday(date)
        ? "sunday"
        : "",

      date ===
      todayISO()
        ? "today"
        : "",

      stateValue !==
      "default"
        ? stateValue
        : ""
    ]
      .filter(
        Boolean
      )
      .join(" ");

    cells += `
      <button
        type="button"
        class="${classes}"
        data-date="${date}"
      >
        ${day}
      </button>
    `;
  }

  return `
    <section
      class="month-card"
    >

      <div
        class="month-title"
      >
        ${name}
      </div>

      <div
        class="weekday-row"
      >
        ${[
          "M",
          "T",
          "W",
          "T",
          "F",
          "S",
          "S"
        ]
          .map(
            day =>
              `
                <div
                  class="weekday"
                >
                  ${day}
                </div>
              `
          )
          .join("")}
      </div>

      <div
        class="date-grid"
      >
        ${cells}
      </div>

    </section>
  `;
}

function cycleCalendarDate(
  date
) {
  if (
    isSunday(date)
  ) {
    return;
  }

  const current =
    getCalendarState(
      date
    );

  const nextStates = {
    default:
      "holiday",

    holiday:
      "important",

    important:
      "present",

    present:
      "default"
  };

  const next =
    nextStates[
      current
    ];

  if (
    next ===
    "default"
  ) {
    delete state.calendarStates[
      date
    ];
  }
  else {
    state.calendarStates[
      date
    ] =
      next;
  }

  addHistory({
    type:
      "info",

    date:
      date,

    detail:
      `Calendar state changed to ${next}`
  });

  persistState();

  renderMonthGrid();

  renderMain(false);
}

/* ============================================================
   TODAY HOLIDAY
============================================================ */

els.markTodayHoliday.addEventListener(
  "click",
  () => {
    const today =
      todayISO();

    if (
      isSunday(
        today
      )
    ) {
      alert(
        "Sunday is an immutable holiday."
      );

      return;
    }

    if (
      state.calendarStates[
        today
      ] ===
      "holiday"
    ) {
      delete state.calendarStates[
        today
      ];

      addHistory({
        type:
          "info",

        date:
          today,

        detail:
          "Today holiday removed"
      });
    }
    else {
      state.calendarStates[
        today
      ] =
        "holiday";

      addHistory({
        type:
          "info",

        date:
          today,

        detail:
          "Today marked holiday"
      });
    }

    persistState();

    renderMain(false);
  }
);

/* ============================================================
   CALENDAR FILE
============================================================ */

function handleCalendarUpload(
  event
) {
  const file =
    event.target.files?.[0];

  if (
    !file
  ) {
    return;
  }

  state.calendarUploadedName =
    file.name;

  persistState();

  const label =
    $("#calendarFileName");

  if (
    label
  ) {
    label.textContent =
      file.name;
  }

  if (
    calendarObjectURL
  ) {
    URL.revokeObjectURL(
      calendarObjectURL
    );
  }

  calendarObjectURL =
    URL.createObjectURL(
      file
    );

  const preview =
    $("#calendarPreviewContent");

  if (
    file.type ===
      "application/pdf" ||
    file.name
      .toLowerCase()
      .endsWith(".pdf")
  ) {
    preview.innerHTML = `
      <iframe
        src="${calendarObjectURL}"
        title="Academic calendar"
      ></iframe>
    `;
  }
  else if (
    file.type.startsWith(
      "image/"
    )
  ) {
    preview.innerHTML = `
      <img
        src="${calendarObjectURL}"
        alt="Academic calendar"
        draggable="false"
      >
    `;
  }
  else {
    preview.innerHTML = `
      <div
        class="calendar-preview-empty"
      >
        Unsupported file type.
      </div>
    `;
  }

  app.calendarPreview.scale =
    1;

  applyCalendarPreviewTransform();
}

/* ============================================================
   PINCH ZOOM
============================================================ */

function distance(
  a,
  b
) {
  return Math.hypot(
    a.x -
      b.x,

    a.y -
      b.y
  );
}

function applyCalendarPreviewTransform() {
  const content =
    $("#calendarPreviewContent");

  if (
    !content
  ) {
    return;
  }

  content.style.transform =
    `scale(${app.calendarPreview.scale})`;
}

function setupCalendarPinchZoom() {
  const preview =
    $("#calendarPreview");

  if (
    !preview
  ) {
    return;
  }

  const pointers =
    new Map();

  preview.style.touchAction =
    "none";

  preview.addEventListener(
    "pointerdown",
    event => {
      pointers.set(
        event.pointerId,
        {
          x:
            event.clientX,

          y:
            event.clientY
        }
      );

      if (
        pointers.size ===
        2
      ) {
        const points =
          Array.from(
            pointers.values()
          );

        app.calendarPreview.startDistance =
          distance(
            points[0],
            points[1]
          );

        app.calendarPreview.startScale =
          app.calendarPreview.scale;
      }
    }
  );

  preview.addEventListener(
    "pointermove",
    event => {
      if (
        !pointers.has(
          event.pointerId
        )
      ) {
        return;
      }

      pointers.set(
        event.pointerId,
        {
          x:
            event.clientX,

          y:
            event.clientY
        }
      );

      if (
        pointers.size !==
        2
      ) {
        return;
      }

      const points =
        Array.from(
          pointers.values()
        );

      const currentDistance =
        distance(
          points[0],
          points[1]
        );

      const startDistance =
        app.calendarPreview
          .startDistance;

      if (
        startDistance <=
        0
      ) {
        return;
      }

      const ratio =
        currentDistance /
        startDistance;

      app.calendarPreview.scale =
        clamp(
          app.calendarPreview
            .startScale *
            ratio,

          1,

          4
        );

      applyCalendarPreviewTransform();
    }
  );

  const release =
    event => {
      pointers.delete(
        event.pointerId
      );

      if (
        pointers.size <
        2
      ) {
        app.calendarPreview.startDistance =
          0;
      }
    };

  preview.addEventListener(
    "pointerup",
    release
  );

  preview.addEventListener(
    "pointercancel",
    release
  );
}

/* ============================================================
   MOBILE SCROLL TRAP
============================================================ */

function installOnePixelScrollTrap(
  container
) {
  if (
    !container
  ) {
    return;
  }

  if (
    container.dataset
      .scrollTrapInstalled ===
    "true"
  ) {
    return;
  }

  container.dataset
    .scrollTrapInstalled =
    "true";

  let startY =
    0;

  let startScrollTop =
    0;

  container.addEventListener(
    "touchstart",
    event => {
      if (
        !event.touches.length
      ) {
        return;
      }

      startY =
        event.touches[0]
          .clientY;

      startScrollTop =
        container.scrollTop;

      const maxScroll =
        container.scrollHeight -
        container.clientHeight;

      if (
        maxScroll > 0 &&
        container.scrollTop <=
          0
      ) {
        container.scrollTop =
          1;
      }

      if (
        maxScroll > 0 &&
        container.scrollTop >=
          maxScroll
      ) {
        container.scrollTop =
          Math.max(
            0,
            maxScroll - 1
          );
      }
    },
    {
      passive:
        true
    }
  );

  container.addEventListener(
    "touchmove",
    event => {
      if (
        !event.touches.length
      ) {
        return;
      }

      const currentY =
        event.touches[0]
          .clientY;

      const delta =
        currentY -
        startY;

      const maxScroll =
        container.scrollHeight -
        container.clientHeight;

      if (
        maxScroll <=
        0
      ) {
        return;
      }

      const atTop =
        startScrollTop <=
        1;

      const atBottom =
        startScrollTop >=
        maxScroll - 1;

      if (
        atTop &&
        delta >
          0
      ) {
        event.preventDefault();

        return;
      }

      if (
        atBottom &&
        delta <
          0
      ) {
        event.preventDefault();
      }
    },
    {
      passive:
        false
    }
  );
}

/* ============================================================
   DYNAMIC REFRESH
============================================================ */

function refreshDynamicAttendanceUI() {
  /*
   * Never rebuild the page while a modal is open.
   */
  if (
    !els.modalBackdrop.classList.contains(
      "hidden"
    )
  ) {
    return;
  }

  /*
   * Keep the user's horizontal scroll position.
   */
  const previousScroll =
    els.timeline.scrollLeft;

  const previousCourse =
    app.openCourse;

  renderSummary();

  renderDaySelector();

  renderSelectedDay(
    false
  );

  renderCourseDashboard();

  app.openCourse =
    previousCourse;

  requestAnimationFrame(
    () => {
      els.timeline.scrollLeft =
        previousScroll;
    }
  );
}

/* ============================================================
   INITIALIZE
============================================================ */

function initialize() {
  applyTheme();

  renderMain(
    true
  );

  startClock();

  setInterval(
    refreshDynamicAttendanceUI,
    15000
  );
}

/*
 * Wait for the DOM before initializing everything.
 * This is the important fix for the date/time loading problem.
 */
if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );
}
else {
  initialize();
}