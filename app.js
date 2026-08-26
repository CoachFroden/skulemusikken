const STORAGE_KEY = "skulemusikken-vakter-v2";

// Terminlisten som ble lastet opp er for hausten 2026.
// Personnavn legges ikke i kildekoden så lenge GitHub-repoet er offentlig.
const DEFAULT_DATES = [
  "2026-08-20",
  "2026-08-27",
  "2026-09-03",
  "2026-09-10",
  "2026-09-24",
  "2026-10-01",
  "2026-10-15",
  "2026-10-22",
  "2026-10-29",
  "2026-11-05",
  "2026-11-12",
  "2026-11-19",
  "2026-11-26",
  "2026-12-03",
  "2026-12-17"
];

const addDutyBtn = document.querySelector("#addDutyBtn");
const dutyDialog = document.querySelector("#dutyDialog");
const dutyForm = document.querySelector("#dutyForm");
const closeDialogBtn = document.querySelector("#closeDialogBtn");
const cancelBtn = document.querySelector("#cancelBtn");
const jumpToDutiesBtn = document.querySelector("#jumpToDutiesBtn");
const filterSelect = document.querySelector("#filterSelect");
const dutyList = document.querySelector("#dutyList");
const emptyState = document.querySelector("#emptyState");
const nextThursdayTitle = document.querySelector("#nextThursdayTitle");
const nextDutySummary = document.querySelector("#nextDutySummary");

const dateInput = document.querySelector("#dateInput");
const hovedInput = document.querySelector("#hovedInput");
const juniorInput = document.querySelector("#juniorInput");
const aspirantInput = document.querySelector("#aspirantInput");
const styreInput = document.querySelector("#styreInput");

function makeDefaultDuties() {
  return DEFAULT_DATES.map((date, index) => ({
    id: `default-${index + 1}`,
    date,
    hoved: "",
    junior: "",
    aspirant: "",
    styre: ""
  }));
}

function loadDuties() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return makeDefaultDuties();
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : makeDefaultDuties();
  } catch {
    return makeDefaultDuties();
  }
}

function saveDuties(duties) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(duties));
}

function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(parseDateOnly(value));
}

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextPlannedDuty(duties) {
  const today = todayDateOnly();
  return duties
    .filter((duty) => parseDateOnly(duty.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

function item(label, value, key) {
  const shown = value ? escapeHtml(value) : "Ikke lagt inn";
  const emptyClass = value ? "" : " is-empty";
  return `<div class="duty-item${emptyClass}" data-type="${key}"><strong>${label}</strong><span>${shown}</span></div>`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function renderNextDuty(duties) {
  const next = nextPlannedDuty(duties);
  if (!next) {
    nextThursdayTitle.textContent = "Ingen flere vaktdatoer lagt inn";
    nextDutySummary.innerHTML = "";
    return;
  }

  nextThursdayTitle.textContent = formatDate(next.date);
  nextDutySummary.innerHTML = `
    <div class="duty-grid">
      ${item("Hovedkorps", next.hoved, "hoved")}
      ${item("Juniorkorps", next.junior, "junior")}
      ${item("Aspirantkorps", next.aspirant, "aspirant")}
      ${item("Styrevakt", next.styre, "styre")}
    </div>`;
}

function render() {
  const filter = filterSelect.value;
  const duties = loadDuties().sort((a, b) => a.date.localeCompare(b.date));
  renderNextDuty(duties);

  const visible = duties.filter((duty) => {
    if (filter === "all") return true;
    return Boolean(duty[filter]);
  });

  emptyState.hidden = visible.length > 0;

  dutyList.innerHTML = visible.map((duty) => {
    const content = filter === "all"
      ? [
          item("Hovedkorps", duty.hoved, "hoved"),
          item("Juniorkorps", duty.junior, "junior"),
          item("Aspirantkorps", duty.aspirant, "aspirant"),
          item("Styrevakt", duty.styre, "styre")
        ].join("")
      : item({hoved:"Hovedkorps",junior:"Juniorkorps",aspirant:"Aspirantkorps",styre:"Styrevakt"}[filter], duty[filter], filter);

    return `
      <article class="duty-card">
        <div class="duty-date">${formatDate(duty.date)}</div>
        <div class="duty-grid">${content}</div>
        <div class="duty-actions">
          <button class="edit-btn" type="button" data-edit-id="${duty.id}">Endre</button>
        </div>
      </article>`;
  }).join("");
}

function openDialog(duty = null) {
  dutyForm.reset();
  if (duty) {
    dateInput.value = duty.date;
    hovedInput.value = duty.hoved || "";
    juniorInput.value = duty.junior || "";
    aspirantInput.value = duty.aspirant || "";
    styreInput.value = duty.styre || "";
  } else {
    const next = nextPlannedDuty(loadDuties());
    dateInput.value = next ? next.date : toDateInputValue(todayDateOnly());
  }
  dutyDialog.showModal();
  dateInput.focus();
}

function closeDialog() {
  dutyDialog.close();
}

addDutyBtn.addEventListener("click", () => openDialog());
closeDialogBtn.addEventListener("click", closeDialog);
cancelBtn.addEventListener("click", closeDialog);
filterSelect.addEventListener("change", render);
jumpToDutiesBtn.addEventListener("click", () => document.querySelector("#dutiesSection").scrollIntoView({ behavior: "smooth" }));

dutyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const values = {
    hoved: hovedInput.value.trim(),
    junior: juniorInput.value.trim(),
    aspirant: aspirantInput.value.trim(),
    styre: styreInput.value.trim()
  };

  if (!dateInput.value) return;

  const duties = loadDuties();
  const existing = duties.find((duty) => duty.date === dateInput.value);

  if (existing) {
    Object.assign(existing, values);
  } else {
    duties.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: dateInput.value,
      ...values
    });
  }

  saveDuties(duties);
  closeDialog();
  render();
});

dutyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  const duty = loadDuties().find((item) => item.id === button.dataset.editId);
  if (duty) openDialog(duty);
});

render();
