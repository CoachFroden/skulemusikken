import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const APP_ROOT = ["apps", "skulemusikken"];

const DEFAULT_DATES = [
  "2026-08-20", "2026-08-27", "2026-09-03", "2026-09-10", "2026-09-24",
  "2026-10-01", "2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05",
  "2026-11-12", "2026-11-19", "2026-11-26", "2026-12-03", "2026-12-17"
];

// Offentlig terminlisteinformasjon. Navn på vakter/komiteer lagres kun i Firestore.
const TERM_EVENTS = [
  {
    id: "seminar-2026-08-21",
    date: "2026-08-21",
    title: "Seminar",
    time: "17:30–19:45",
    details: "Oppmøte 17:15. Aspirantkorpset har ikke seminar."
  },
  {
    id: "seminar-2026-08-22",
    date: "2026-08-22",
    title: "Seminar",
    time: "10:00–16:00",
    details: "Aspirantkorps: seminar 11:00–15:00."
  },
  {
    id: "andeslepp-2026-09",
    date: null,
    monthLabel: "September",
    title: "Andeslepp",
    time: "18:00",
    details: "Dato er ikke oppgitt i terminlista."
  },
  {
    id: "haustferie-2026-10-08",
    date: "2026-10-08",
    title: "Haustferie",
    time: "",
    details: "Ingen ordinær øving."
  },
  {
    id: "seminar-2026-10-23",
    date: "2026-10-23",
    title: "Seminar",
    time: "17:30–19:45",
    details: "Oppmøte 17:15. Aspirantkorpset har ikke seminar."
  },
  {
    id: "seminar-2026-10-24",
    date: "2026-10-24",
    title: "Seminar",
    time: "10:00–16:00",
    details: "Aspirantkorps: seminar 11:00–15:00."
  },
  {
    id: "jubileum-2026-10-25",
    date: "2026-10-25",
    title: "Jubileumskonsert",
    time: "",
    details: "Tidspunkt er ikke oppgitt i terminlista."
  },
  {
    id: "julegrantenning-2026-11-29",
    date: "2026-11-29",
    title: "Julegrantenning",
    time: "16:00",
    details: "Hovudkorps."
  },
  {
    id: "julekonsert-2026-12-10",
    date: "2026-12-10",
    title: "Julekonsert",
    time: "18:00",
    details: ""
  }
];

const $ = (selector) => document.querySelector(selector);

const addDutyBtn = $("#addDutyBtn");
const importDutyBtn = $("#importDutyBtn");
const importEventBtn = $("#importEventBtn");
const dutyDialog = $("#dutyDialog");
const dutyForm = $("#dutyForm");
const closeDialogBtn = $("#closeDialogBtn");
const cancelBtn = $("#cancelBtn");
const jumpToDutiesBtn = $("#jumpToDutiesBtn");
const filterSelect = $("#filterSelect");
const dutyList = $("#dutyList");
const eventList = $("#eventList");
const emptyState = $("#emptyState");
const nextThursdayTitle = $("#nextThursdayTitle");
const nextDutySummary = $("#nextDutySummary");
const authStatus = $("#authStatus");
const loginBtn = $("#loginBtn");
const logoutBtn = $("#logoutBtn");

const importDialog = $("#importDialog");
const importForm = $("#importForm");
const importText = $("#importText");
const importResult = $("#importResult");
const closeImportBtn = $("#closeImportBtn");
const cancelImportBtn = $("#cancelImportBtn");

const eventImportDialog = $("#eventImportDialog");
const eventImportForm = $("#eventImportForm");
const eventImportText = $("#eventImportText");
const eventImportResult = $("#eventImportResult");
const closeEventImportBtn = $("#closeEventImportBtn");
const cancelEventImportBtn = $("#cancelEventImportBtn");

const dateInput = $("#dateInput");
const hovedInput = $("#hovedInput");
const juniorInput = $("#juniorInput");
const aspirantInput = $("#aspirantInput");
const styreInput = $("#styreInput");

const firebaseConfig = window.SKULEMUSIKKEN_FIREBASE_CONFIG;
const firebaseReady = Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

let auth = null;
let db = null;
let approvedUser = false;
let currentRole = null;
let currentUser = null;
let duties = makeDefaultDuties();
let eventAssignments = new Map();

function dutiesCollection() {
  return collection(db, ...APP_ROOT, "duties");
}

function dutyDocument(date) {
  return doc(db, ...APP_ROOT, "duties", date);
}

function eventAssignmentDocument(eventId) {
  return doc(db, ...APP_ROOT, "duties", `event-${eventId}`);
}

function memberDocument(uid) {
  return doc(db, ...APP_ROOT, "members", uid);
}

function makeDefaultDuties() {
  return DEFAULT_DATES.map((date) => ({ id: date, date, hoved: "", junior: "", aspirant: "", styre: "" }));
}

function mergePrivateDuties(privateRows) {
  const byDate = new Map(makeDefaultDuties().map((row) => [row.date, row]));
  for (const row of privateRows) {
    if (!row.date || row.eventId) continue;
    byDate.set(row.date, {
      id: row.date,
      date: row.date,
      hoved: row.hoved || "",
      junior: row.junior || "",
      aspirant: row.aspirant || "",
      styre: row.styre || ""
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long" }).format(parseDateOnly(value));
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

function nextPlannedDuty(rows) {
  const today = todayDateOnly();
  return rows.filter((duty) => parseDateOnly(duty.date) >= today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function item(label, value, key) {
  let shown = "Logg inn for å se vakt";
  let emptyClass = " is-empty";
  if (approvedUser) {
    shown = value ? escapeHtml(value) : "Ikke lagt inn";
    emptyClass = value ? "" : " is-empty";
  }
  return `<div class="duty-item${emptyClass}" data-type="${key}"><strong>${label}</strong><span>${shown}</span></div>`;
}

function renderNextDuty() {
  const next = nextPlannedDuty(duties);
  if (!next) {
    nextThursdayTitle.textContent = "Ingen flere vaktdatoer lagt inn";
    nextDutySummary.innerHTML = "";
    return;
  }
  nextThursdayTitle.textContent = formatDate(next.date);
  nextDutySummary.innerHTML = `<div class="duty-grid">
    ${item("Hovedkorps", next.hoved, "hoved")}
    ${item("Juniorkorps", next.junior, "junior")}
    ${item("Aspirantkorps", next.aspirant, "aspirant")}
    ${item("Styrevakt", next.styre, "styre")}
  </div>`;
}

function assignmentLine(label, value) {
  if (!value) return "";
  return `<div class="event-assignment"><strong>${label}:</strong> ${escapeHtml(value)}</div>`;
}

function renderEvents() {
  eventList.innerHTML = TERM_EVENTS.map((event) => {
    const assignment = eventAssignments.get(event.id) || {};
    const dateLabel = event.date ? formatDate(event.date) : event.monthLabel || "Dato ikke oppgitt";
    let privateInfo = `<p class="muted event-private">Logg inn for å se vakter og komité.</p>`;

    if (approvedUser) {
      const lines = [
        assignmentLine("Hovedkorps", assignment.hoved),
        assignmentLine("Juniorkorps", assignment.junior),
        assignmentLine("Aspirantkorps", assignment.aspirant),
        assignmentLine("Styrevakt", assignment.styre),
        assignmentLine("Komité", assignment.komite),
        assignmentLine("Mat", assignment.mat)
      ].filter(Boolean).join("");
      privateInfo = lines || `<p class="muted event-private">Ingen vakt/komité er oppgitt.</p>`;
    }

    return `<article class="event-card">
      <div class="event-date">${escapeHtml(dateLabel)}</div>
      <div class="event-body">
        <div class="event-title-row">
          <h3>${escapeHtml(event.title)}</h3>
          ${event.time ? `<span class="event-time">${escapeHtml(event.time)}</span>` : ""}
        </div>
        ${event.details ? `<p class="muted">${escapeHtml(event.details)}</p>` : ""}
        <div class="event-assignments">${privateInfo}</div>
      </div>
    </article>`;
  }).join("");
}

function render() {
  renderNextDuty();
  renderEvents();
  const filter = filterSelect.value;
  const visible = duties.filter((duty) => filter === "all" || !approvedUser || Boolean(duty[filter]));
  emptyState.hidden = visible.length > 0;

  dutyList.innerHTML = visible.map((duty) => {
    const content = filter === "all"
      ? [item("Hovedkorps", duty.hoved, "hoved"), item("Juniorkorps", duty.junior, "junior"), item("Aspirantkorps", duty.aspirant, "aspirant"), item("Styrevakt", duty.styre, "styre")].join("")
      : item({ hoved:"Hovedkorps", junior:"Juniorkorps", aspirant:"Aspirantkorps", styre:"Styrevakt" }[filter], duty[filter], filter);

    const editButton = approvedUser ? `<div class="duty-actions"><button class="edit-btn" type="button" data-edit-id="${duty.id}">Endre</button></div>` : "";
    return `<article class="duty-card"><div class="duty-date">${formatDate(duty.date)}</div><div class="duty-grid">${content}</div>${editButton}</article>`;
  }).join("");

  addDutyBtn.disabled = !approvedUser;
  addDutyBtn.title = approvedUser ? "" : "Krever godkjent innlogging";
  importDutyBtn.hidden = currentRole !== "admin";
  importEventBtn.hidden = currentRole !== "admin";
}

function setAuthStatus(message, kind = "info") {
  authStatus.textContent = message;
  authStatus.dataset.kind = kind;
}

async function loadPrivateDuties() {
  const snapshot = await getDocs(dutiesCollection());
  const rows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  duties = mergePrivateDuties(rows);
  eventAssignments = new Map(rows.filter((row) => row.eventId).map((row) => [row.eventId, row]));
  render();
}

async function checkMembership(user) {
  const memberSnap = await getDoc(memberDocument(user.uid));
  approvedUser = memberSnap.exists();
  currentRole = approvedUser ? (memberSnap.data()?.role || "member") : null;
  if (!approvedUser) {
    duties = makeDefaultDuties();
    eventAssignments = new Map();
    setAuthStatus(`Innlogget, men ikke godkjent ennå. UID: ${user.uid}`, "warning");
    render();
    return;
  }
  setAuthStatus(`Innlogget som ${user.email || "godkjent bruker"}`, "success");
  await loadPrivateDuties();
}

function openDialog(duty = null) {
  if (!approvedUser) return;
  dutyForm.reset();
  if (duty) {
    dateInput.value = duty.date;
    hovedInput.value = duty.hoved || "";
    juniorInput.value = duty.junior || "";
    aspirantInput.value = duty.aspirant || "";
    styreInput.value = duty.styre || "";
  } else {
    const next = nextPlannedDuty(duties);
    dateInput.value = next ? next.date : toDateInputValue(todayDateOnly());
  }
  dutyDialog.showModal();
  dateInput.focus();
}

function parseDutyRows(text) {
  const rows = [];
  const errors = [];
  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;
    const separator = line.includes("\t") ? "\t" : "|";
    const parts = line.split(separator).map((part) => part.trim());
    if (parts.length !== 5) return errors.push(`Linje ${index + 1}: forventet 5 felt.`);
    const [date, hoved, junior, aspirant, styre] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errors.push(`Linje ${index + 1}: ugyldig dato «${date}».`);
    rows.push({ date, hoved, junior, aspirant, styre });
  });
  return { rows, errors };
}

function parseEventRows(text) {
  const rows = [];
  const errors = [];
  const validIds = new Set(TERM_EVENTS.map((event) => event.id));
  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;
    const separator = line.includes("\t") ? "\t" : "|";
    const parts = line.split(separator).map((part) => part.trim());
    if (parts.length !== 7) return errors.push(`Linje ${index + 1}: forventet 7 felt.`);
    const [eventId, hoved, junior, aspirant, styre, komite, mat] = parts;
    if (!validIds.has(eventId)) return errors.push(`Linje ${index + 1}: ukjent arrangement-id «${eventId}».`);
    rows.push({ eventId, hoved, junior, aspirant, styre, komite, mat });
  });
  return { rows, errors };
}

addDutyBtn.addEventListener("click", () => openDialog());
importDutyBtn.addEventListener("click", () => { importForm.reset(); importResult.textContent = ""; importDialog.showModal(); importText.focus(); });
importEventBtn.addEventListener("click", () => { eventImportForm.reset(); eventImportResult.textContent = ""; eventImportDialog.showModal(); eventImportText.focus(); });
closeDialogBtn.addEventListener("click", () => dutyDialog.close());
cancelBtn.addEventListener("click", () => dutyDialog.close());
closeImportBtn.addEventListener("click", () => importDialog.close());
cancelImportBtn.addEventListener("click", () => importDialog.close());
closeEventImportBtn.addEventListener("click", () => eventImportDialog.close());
cancelEventImportBtn.addEventListener("click", () => eventImportDialog.close());
filterSelect.addEventListener("change", render);
jumpToDutiesBtn.addEventListener("click", () => $("#dutiesSection").scrollIntoView({ behavior: "smooth" }));

loginBtn.addEventListener("click", async () => {
  if (!firebaseReady || !auth) return;
  loginBtn.disabled = true;
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (error) { console.error(error); setAuthStatus("Innlogging feilet. Kontroller Firebase Authentication og godkjent domene.", "error"); }
  finally { loginBtn.disabled = false; }
});

logoutBtn.addEventListener("click", async () => { if (auth) await signOut(auth); });

dutyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!approvedUser || !db || !dateInput.value) return;
  const values = {
    date: dateInput.value,
    hoved: hovedInput.value.trim(), junior: juniorInput.value.trim(), aspirant: aspirantInput.value.trim(), styre: styreInput.value.trim(),
    updatedAt: serverTimestamp(), updatedBy: currentUser?.uid || null
  };
  const submitButton = dutyForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try { await setDoc(dutyDocument(values.date), values, { merge: true }); dutyDialog.close(); await loadPrivateDuties(); }
  catch (error) { console.error(error); setAuthStatus("Kunne ikke lagre vakten. Kontroller Firestore-reglene.", "error"); }
  finally { submitButton.disabled = false; }
});

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (currentRole !== "admin" || !db) return;
  const { rows, errors } = parseDutyRows(importText.value);
  if (errors.length) { importResult.textContent = errors.slice(0, 4).join(" "); importResult.dataset.kind = "error"; return; }
  if (!rows.length) { importResult.textContent = "Ingen gyldige linjer å importere."; importResult.dataset.kind = "error"; return; }
  const submitButton = importForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const batch = writeBatch(db);
    rows.forEach((row) => batch.set(dutyDocument(row.date), { ...row, source: "terminliste-haust-2026", updatedAt: serverTimestamp(), updatedBy: currentUser?.uid || null }, { merge: true }));
    await batch.commit(); await loadPrivateDuties(); importText.value = "";
    importResult.textContent = `${rows.length} vaktdatoer er lagret privat i Firestore.`; importResult.dataset.kind = "success";
  } catch (error) { console.error(error); importResult.textContent = "Importen feilet."; importResult.dataset.kind = "error"; }
  finally { submitButton.disabled = false; }
});

eventImportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (currentRole !== "admin" || !db) return;
  const { rows, errors } = parseEventRows(eventImportText.value);
  if (errors.length) { eventImportResult.textContent = errors.slice(0, 4).join(" "); eventImportResult.dataset.kind = "error"; return; }
  if (!rows.length) { eventImportResult.textContent = "Ingen gyldige linjer å importere."; eventImportResult.dataset.kind = "error"; return; }
  const submitButton = eventImportForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const batch = writeBatch(db);
    rows.forEach((row) => batch.set(eventAssignmentDocument(row.eventId), { ...row, source: "terminliste-haust-2026", updatedAt: serverTimestamp(), updatedBy: currentUser?.uid || null }, { merge: true }));
    await batch.commit(); await loadPrivateDuties(); eventImportText.value = "";
    eventImportResult.textContent = `${rows.length} arrangement er oppdatert med private vakt-/komitédata.`; eventImportResult.dataset.kind = "success";
  } catch (error) { console.error(error); eventImportResult.textContent = "Importen feilet."; eventImportResult.dataset.kind = "error"; }
  finally { submitButton.disabled = false; }
});

dutyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (!button || !approvedUser) return;
  const duty = duties.find((item) => item.id === button.dataset.editId || item.date === button.dataset.editId);
  if (duty) openDialog(duty);
});

if (!firebaseReady) {
  loginBtn.disabled = true;
  logoutBtn.hidden = true;
  importDutyBtn.hidden = true;
  importEventBtn.hidden = true;
  setAuthStatus("Firebase er klargjort i koden, men prosjektkonfigurasjonen mangler.", "warning");
  render();
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    approvedUser = false;
    currentRole = null;
    duties = makeDefaultDuties();
    eventAssignments = new Map();
    loginBtn.hidden = Boolean(user);
    logoutBtn.hidden = !user;
    if (!user) { setAuthStatus("Logg inn for å se navn i vaktplanen."); render(); return; }
    try { setAuthStatus("Kontrollerer tilgang …"); await checkMembership(user); }
    catch (error) { console.error(error); setAuthStatus(`Tilgang kunne ikke bekreftes. UID: ${user.uid}`, "error"); render(); }
  });
}
