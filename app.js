const STORAGE_KEY = "skulemusikken-vakter-v1";

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

const dateInput = document.querySelector("#dateInput");
const hovedInput = document.querySelector("#hovedInput");
const juniorInput = document.querySelector("#juniorInput");
const aspirantInput = document.querySelector("#aspirantInput");
const styreInput = document.querySelector("#styreInput");

function loadDuties() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
    month: "long",
    year: "numeric"
  }).format(parseDateOnly(value));
}

function nextThursday() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = date.getDay();
  let diff = (4 - day + 7) % 7;
  if (diff === 0 && now.getHours() >= 20) diff = 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateNextThursday() {
  nextThursdayTitle.textContent = new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(nextThursday());
}

function item(label, value, key) {
  if (!value) return "";
  return `<div class="duty-item" data-type="${key}"><strong>${label}</strong><span>${escapeHtml(value)}</span></div>`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function render() {
  const filter = filterSelect.value;
  const duties = loadDuties().sort((a, b) => a.date.localeCompare(b.date));

  const visible = duties.filter((duty) => {
    if (filter === "all") return true;
    return Boolean(duty[filter]);
  });

  emptyState.hidden = duties.length > 0;

  if (visible.length === 0 && duties.length > 0) {
    dutyList.innerHTML = `<div class="empty-state"><h3>Ingen vakter i dette filteret</h3><p>Velg «Alle» eller et annet korps.</p></div>`;
    return;
  }

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
          <button class="delete-btn" type="button" data-delete-id="${duty.id}">Slett</button>
        </div>
      </article>`;
  }).join("");
}

function openDialog() {
  dutyForm.reset();
  dateInput.value = toDateInputValue(nextThursday());
  dutyDialog.showModal();
  dateInput.focus();
}

function closeDialog() {
  dutyDialog.close();
}

addDutyBtn.addEventListener("click", openDialog);
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

  if (!dateInput.value || !Object.values(values).some(Boolean)) {
    return;
  }

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
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;

  const id = button.dataset.deleteId;
  const duties = loadDuties().filter((duty) => duty.id !== id);
  saveDuties(duties);
  render();
});

updateNextThursday();
render();
