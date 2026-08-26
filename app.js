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

// Alt privat innhold ligger under apps/skulemusikken/...
const APP_ROOT = ["apps", "skulemusikken"];

// Datoene er offentlige. Personnavn ligger bare i Firestore.
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
const importDutyBtn = document.querySelector("#importDutyBtn");
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
const authStatus = document.querySelector("#authStatus");
const loginBtn = document.querySelector("#loginBtn");
const logoutBtn = document.querySelector("#logoutBtn");

const importDialog = document.querySelector("#importDialog");
const importForm = document.querySelector("#importForm");
const importText = document.querySelector("#importText");
const importResult = document.querySelector("#importResult");
const closeImportBtn = document.querySelector("#closeImportBtn");
const cancelImportBtn = document.querySelector("#cancelImportBtn");

const dateInput = document.querySelector("#dateInput");
const hovedInput = document.querySelector("#hovedInput");
const juniorInput = document.querySelector("#juniorInput");
const aspirantInput = document.querySelector("#aspirantInput");
const styreInput = document.querySelector("#styreInput");

const firebaseConfig = window.SKULEMUSIKKEN_FIREBASE_CONFIG;
const firebaseReady = Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

let auth = null;
let db = null;
let approvedUser = false;
let currentRole = null;
let currentUser = null;
let duties = makeDefaultDuties();

function dutiesCollection() {
  return collection(db, ...APP_ROOT, "duties");
}

function dutyDocument(date) {
  return doc(db, ...APP_ROOT, "duties", date);
}

function memberDocument(uid) {
  return doc(db, ...APP_ROOT, "members", uid);
}

function makeDefaultDuties() {
  return DEFAULT_DATES.map((date) => ({
    id: date,
    date,
    hoved: "",
    junior: "",
    aspirant: "",
    styre: ""
  }));
}

function mergePrivateDuties(privateRows) {
  const byDate = new Map(makeDefaultDuties().map((row) => [row.date, row]));
  for (const row of privateRows) {
    if (!row.date) continue;
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

function nextPlannedDuty(rows) {
  const today = todayDateOnly();
  return rows
    .filter((duty) => parseDateOnly(duty.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
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
  nextDutySummary.innerHTML = `
    <div class="duty-grid">
      ${item("Hovedkorps", next.hoved, "hoved")}
      ${item("Juniorkorps", next.junior, "junior")}
      ${item("Aspirantkorps", next.aspirant, "aspirant")}
      ${item("Styrevakt", next.styre, "styre")}
    </div>`;
}

function render() {
  renderNextDuty();
  const filter = filterSelect.value;

  const visible = duties.filter((duty) => {
    if (filter === "all") return true;
    if (!approvedUser) return true;
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

    const editButton = approvedUser
      ? `<div class="duty-actions"><button class="edit-btn" type="button" data-edit-id="${duty.id}">Endre</button></div>`
      : "";

    return `
      <article class="duty-card">
        <div class="duty-date">${formatDate(duty.date)}</div>
        <div class="duty-grid">${content}</div>
        ${editButton}
      </article>`;
  }).join("");

  addDutyBtn.disabled = !approvedUser;
  addDutyBtn.title = approvedUser ? "" : "Krever godkjent innlogging";
  importDutyBtn.hidden = currentRole !== "admin";
}

function setAuthStatus(message, kind = "info") {
  authStatus.textContent = message;
  authStatus.dataset.kind = kind;
}

async function loadPrivateDuties() {
  const snapshot = await getDocs(dutiesCollection());
  const privateRows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  duties = mergePrivateDuties(privateRows);
  render();
}

async function checkMembership(user) {
  const memberSnap = await getDoc(memberDocument(user.uid));
  approvedUser = memberSnap.exists();
  currentRole = approvedUser ? (memberSnap.data()?.role || "member") : null;

  if (!approvedUser) {
    duties = makeDefaultDuties();
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

function closeDialog() {
  dutyDialog.close();
}

function openImportDialog() {
  if (currentRole !== "admin") return;
  importForm.reset();
  importResult.textContent = "";
  importDialog.showModal();
  importText.focus();
}

function closeImportDialog() {
  importDialog.close();
}

function parseImportRows(text) {
  const rows = [];
  const errors = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const separator = line.includes("\t") ? "\t" : "|";
    const parts = line.split(separator).map((part) => part.trim());

    if (parts.length !== 5) {
      errors.push(`Linje ${index + 1}: forventet 5 felt.`);
      return;
    }

    const [date, hoved, junior, aspirant, styre] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Linje ${index + 1}: ugyldig dato «${date}».`);
      return;
    }

    rows.push({ date, hoved, junior, aspirant, styre });
  });

  return { rows, errors };
}

addDutyBtn.addEventListener("click", () => openDialog());
importDutyBtn.addEventListener("click", openImportDialog);
closeDialogBtn.addEventListener("click", closeDialog);
cancelBtn.addEventListener("click", closeDialog);
closeImportBtn.addEventListener("click", closeImportDialog);
cancelImportBtn.addEventListener("click", closeImportDialog);
filterSelect.addEventListener("change", render);
jumpToDutiesBtn.addEventListener("click", () => document.querySelector("#dutiesSection").scrollIntoView({ behavior: "smooth" }));

loginBtn.addEventListener("click", async () => {
  if (!firebaseReady || !auth) return;
  loginBtn.disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    setAuthStatus("Innlogging feilet. Kontroller Firebase Authentication og godkjent domene.", "error");
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  if (auth) await signOut(auth);
});

dutyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!approvedUser || !db || !dateInput.value) return;

  const values = {
    date: dateInput.value,
    hoved: hovedInput.value.trim(),
    junior: juniorInput.value.trim(),
    aspirant: aspirantInput.value.trim(),
    styre: styreInput.value.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser?.uid || null
  };

  const submitButton = dutyForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    await setDoc(dutyDocument(values.date), values, { merge: true });
    closeDialog();
    await loadPrivateDuties();
  } catch (error) {
    console.error(error);
    setAuthStatus("Kunne ikke lagre vakten. Kontroller Firestore-reglene.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (currentRole !== "admin" || !db) return;

  const { rows, errors } = parseImportRows(importText.value);
  if (errors.length) {
    importResult.textContent = errors.slice(0, 4).join(" ");
    importResult.dataset.kind = "error";
    return;
  }

  if (!rows.length) {
    importResult.textContent = "Ingen gyldige linjer å importere.";
    importResult.dataset.kind = "error";
    return;
  }

  const submitButton = importForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  importResult.textContent = `Importerer ${rows.length} vaktdatoer …`;
  importResult.dataset.kind = "info";

  try {
    const batch = writeBatch(db);
    rows.forEach((row) => {
      batch.set(dutyDocument(row.date), {
        ...row,
        source: "terminliste-haust-2026",
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || null
      }, { merge: true });
    });
    await batch.commit();
    await loadPrivateDuties();
    importText.value = "";
    importResult.textContent = `${rows.length} vaktdatoer er lagret privat i Firestore.`;
    importResult.dataset.kind = "success";
  } catch (error) {
    console.error(error);
    importResult.textContent = "Importen feilet. Ingen navn er lagt i GitHub.";
    importResult.dataset.kind = "error";
  } finally {
    submitButton.disabled = false;
  }
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

    loginBtn.hidden = Boolean(user);
    logoutBtn.hidden = !user;

    if (!user) {
      setAuthStatus("Logg inn for å se navn i vaktplanen.");
      render();
      return;
    }

    try {
      setAuthStatus("Kontrollerer tilgang …");
      await checkMembership(user);
    } catch (error) {
      console.error(error);
      setAuthStatus(`Tilgang kunne ikke bekreftes. UID: ${user.uid}`, "error");
      render();
    }
  });
}
