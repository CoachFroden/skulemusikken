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
const $ = (selector) => document.querySelector(selector);

const DEFAULT_DATES = [
  "2026-08-20", "2026-08-27", "2026-09-03", "2026-09-10", "2026-09-24",
  "2026-10-01", "2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05",
  "2026-11-12", "2026-11-19", "2026-11-26", "2026-12-03", "2026-12-17"
];

const BASE_EVENTS = [
  { id:"seminar-2026-08-21", date:"2026-08-21", title:"Seminar", time:"17:30–19:45", details:"Oppmøte 17:15. Aspirantkorpset har ikke seminar." },
  { id:"seminar-2026-08-22", date:"2026-08-22", title:"Seminar", time:"10:00–16:00", details:"Aspirantkorps: seminar 11:00–15:00." },
  { id:"andeslepp-2026-09", date:null, monthLabel:"September", title:"Andeslepp", time:"18:00", details:"Dato er ikke oppgitt i terminlista." },
  { id:"haustferie-2026-10-08", date:"2026-10-08", title:"Haustferie", time:"", details:"Ingen ordinær øving." },
  { id:"seminar-2026-10-23", date:"2026-10-23", title:"Seminar", time:"17:30–19:45", details:"Oppmøte 17:15. Aspirantkorpset har ikke seminar." },
  { id:"seminar-2026-10-24", date:"2026-10-24", title:"Seminar", time:"10:00–16:00", details:"Aspirantkorps: seminar 11:00–15:00." },
  { id:"jubileum-2026-10-25", date:"2026-10-25", title:"Jubileumskonsert", time:"", details:"Tidspunkt er ikke oppgitt i terminlista." },
  { id:"julegrantenning-2026-11-29", date:"2026-11-29", title:"Julegrantenning", time:"16:00", details:"Hovudkorps." },
  { id:"julekonsert-2026-12-10", date:"2026-12-10", title:"Julekonsert", time:"18:00", details:"" }
];

const firebaseConfig = window.SKULEMUSIKKEN_FIREBASE_CONFIG;
const firebaseReady = Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

let auth = null;
let db = null;
let currentUser = null;
let approvedUser = false;
let currentRole = null;
let duties = makeDefaultDuties();
let eventDocs = new Map();

function dutiesCollection() { return collection(db, ...APP_ROOT, "duties"); }
function dutyDocument(date) { return doc(db, ...APP_ROOT, "duties", date); }
function eventDocument(eventId) { return doc(db, ...APP_ROOT, "duties", `event-${eventId}`); }
function memberDocument(uid) { return doc(db, ...APP_ROOT, "members", uid); }

function makeDefaultDuties() {
  return DEFAULT_DATES.map(date => ({ id:date, date, hoved:"", junior:"", aspirant:"", styre:"" }));
}

function parseDateOnly(value) {
  const [y,m,d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("nb-NO", { weekday:"long", day:"numeric", month:"long" }).format(parseDateOnly(value));
}

function monthName(value) {
  return new Intl.DateTimeFormat("nb-NO", { month:"long" }).format(parseDateOnly(value));
}

function escapeHtml(value="") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function setAuthStatus(message, kind="info") {
  $("#authStatus").textContent = message;
  $("#authStatus").dataset.kind = kind;
}

function mergeDuties(rows) {
  const map = new Map(makeDefaultDuties().map(row => [row.date, row]));
  rows.filter(row => row.date && !row.eventId).forEach(row => {
    map.set(row.date, {
      id:row.date,
      date:row.date,
      hoved:row.hoved || "",
      junior:row.junior || "",
      aspirant:row.aspirant || "",
      styre:row.styre || ""
    });
  });
  return [...map.values()].sort((a,b) => a.date.localeCompare(b.date));
}

function resolvedEvents() {
  return BASE_EVENTS.map(base => {
    const saved = eventDocs.get(base.id) || {};
    return {
      ...base,
      ...saved,
      id:base.id,
      date:saved.date === "" ? null : (saved.date ?? base.date)
    };
  });
}

function dutyToTimeline(duty) {
  return {
    kind:"duty",
    id:duty.id,
    date:duty.date,
    title:"Øving",
    time:"",
    details:"",
    hoved:duty.hoved,
    junior:duty.junior,
    aspirant:duty.aspirant,
    styre:duty.styre
  };
}

function eventToTimeline(event) {
  return { kind:"event", ...event };
}

function timelineItems() {
  const dated = [...duties.map(dutyToTimeline), ...resolvedEvents().filter(e => e.date).map(eventToTimeline)]
    .sort((a,b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  const undated = resolvedEvents().filter(e => !e.date).map(eventToTimeline);
  return [...dated, ...undated];
}

function privateLines(item) {
  if (!approvedUser) return `<p class="muted">Logg inn for å se vakter og komité.</p>`;
  const fields = [
    ["Hovedkorps", item.hoved], ["Juniorkorps", item.junior], ["Aspirantkorps", item.aspirant],
    ["Styrevakt", item.styre], ["Komité", item.komite], ["Mat", item.mat]
  ].filter(([,value]) => value);
  if (!fields.length) return `<p class="muted">Ingen vakt/komité er oppgitt.</p>`;
  return fields.map(([label,value]) => `<div class="timeline-meta"><strong>${label}</strong><span>${escapeHtml(value)}</span></div>`).join("");
}

function renderTimelineCard(item) {
  const dateLabel = item.date ? formatDate(item.date) : `${item.monthLabel || "Dato mangler"}`;
  const typeLabel = item.kind === "duty" ? "Øving" : item.title;
  const editButton = approvedUser
    ? `<button class="edit-btn" type="button" data-edit-kind="${item.kind}" data-edit-id="${item.id}">Rediger</button>`
    : "";
  return `<article class="timeline-card ${item.kind}">
    <div class="timeline-date">${escapeHtml(dateLabel)}</div>
    <div class="timeline-content">
      <div class="timeline-title-row">
        <div>
          <span class="timeline-type">${escapeHtml(typeLabel)}</span>
          ${item.kind === "event" && item.time ? `<span class="timeline-time">${escapeHtml(item.time)}</span>` : ""}
        </div>
        ${editButton}
      </div>
      ${item.kind === "event" && item.details ? `<p class="muted timeline-details">${escapeHtml(item.details)}</p>` : ""}
      <div class="timeline-private">${privateLines(item)}</div>
    </div>
  </article>`;
}

function renderTimeline() {
  const items = timelineItems();
  const container = $("#timelineList");
  if (!items.length) {
    $("#timelineEmpty").hidden = false;
    container.innerHTML = "";
    return;
  }
  $("#timelineEmpty").hidden = true;

  let currentMonth = "";
  let html = "";
  items.forEach(item => {
    const month = item.date ? monthName(item.date) : (item.monthLabel || "Uten dato");
    if (month !== currentMonth) {
      currentMonth = month;
      html += `<h3 class="month-heading">${escapeHtml(month.charAt(0).toUpperCase() + month.slice(1))}</h3>`;
    }
    html += renderTimelineCard(item);
  });
  container.innerHTML = html;
}

function nextTimelineItem() {
  const today = new Date();
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return timelineItems().find(item => item.date && parseDateOnly(item.date) >= day) || null;
}

function renderNext() {
  const next = nextTimelineItem();
  if (!next) {
    $("#nextItemTitle").textContent = "Ingen flere daterte punkt";
    $("#nextItemSummary").innerHTML = "";
    return;
  }

  $("#nextItemTitle").textContent = `${formatDate(next.date)} · ${next.kind === "duty" ? "Øving" : next.title}`;
  const time = next.time ? `<strong>${escapeHtml(next.time)}</strong>` : "";
  const details = next.details ? `<p class="muted">${escapeHtml(next.details)}</p>` : "";
  const dutiesAndAssignments = `<div class="timeline-private next-private">${privateLines(next)}</div>`;
  $("#nextItemSummary").innerHTML = `${time}${details}${dutiesAndAssignments}`;
}

function render() {
  renderNext();
  renderTimeline();
  $("#addDutyBtn").disabled = !approvedUser;
  $("#adminSection").hidden = currentRole !== "admin";
}

async function loadPrivateData() {
  const snapshot = await getDocs(dutiesCollection());
  const rows = snapshot.docs.map(entry => ({ id:entry.id, ...entry.data() }));
  duties = mergeDuties(rows);
  eventDocs = new Map(rows.filter(row => row.eventId).map(row => [row.eventId, row]));
  render();
}

async function checkMembership(user) {
  const memberSnap = await getDoc(memberDocument(user.uid));
  approvedUser = memberSnap.exists();
  currentRole = approvedUser ? (memberSnap.data()?.role || "member") : null;
  if (!approvedUser) {
    duties = makeDefaultDuties();
    eventDocs = new Map();
    setAuthStatus(`Innlogget, men ikke godkjent ennå. UID: ${user.uid}`, "warning");
    render();
    return;
  }
  setAuthStatus(`Innlogget som ${user.email || "godkjent bruker"}`, "success");
  await loadPrivateData();
}

function openDutyDialog(duty=null) {
  if (!approvedUser) return;
  $("#dutyForm").reset();
  const isExisting = Boolean(duty);
  $("#dutyDateInput").disabled = isExisting;
  $("#dutyDateHelp").hidden = !isExisting;
  if (duty) {
    $("#dutyDateInput").value = duty.date;
    $("#hovedInput").value = duty.hoved || "";
    $("#juniorInput").value = duty.junior || "";
    $("#aspirantInput").value = duty.aspirant || "";
    $("#styreInput").value = duty.styre || "";
  } else {
    const next = duties.find(d => !d.hoved && !d.junior && !d.aspirant && !d.styre);
    $("#dutyDateInput").value = next?.date || "";
  }
  $("#dutyDialog").showModal();
}

function openEventDialog(eventId) {
  if (!approvedUser) return;
  const base = BASE_EVENTS.find(e => e.id === eventId);
  if (!base) return;
  const saved = eventDocs.get(eventId) || {};
  const merged = { ...base, ...saved, date:saved.date === "" ? null : (saved.date ?? base.date) };
  $("#eventEditForm").reset();
  $("#eventIdInput").value = eventId;
  $("#eventDateInput").value = merged.date || "";
  $("#eventTimeInput").value = merged.time || "";
  $("#eventTitleInput").value = merged.title || "";
  $("#eventDetailsInput").value = merged.details || "";
  $("#eventHovedInput").value = merged.hoved || "";
  $("#eventJuniorInput").value = merged.junior || "";
  $("#eventAspirantInput").value = merged.aspirant || "";
  $("#eventStyreInput").value = merged.styre || "";
  $("#eventKomiteInput").value = merged.komite || "";
  $("#eventMatInput").value = merged.mat || "";
  $("#eventEditDialog").showModal();
}

function parseRows(text, count) {
  const rows = [], errors = [];
  text.split(/\r?\n/).forEach((raw,index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const separator = line.includes("\t") ? "\t" : "|";
    const parts = line.split(separator).map(x => x.trim());
    if (parts.length !== count) errors.push(`Linje ${index + 1}: forventet ${count} felt.`);
    else rows.push(parts);
  });
  return { rows, errors };
}

$("#loginBtn").addEventListener("click", async () => {
  if (!auth) return;
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (error) { console.error(error); setAuthStatus("Innlogging feilet.", "error"); }
});
$("#logoutBtn").addEventListener("click", async () => { if (auth) await signOut(auth); });
$("#addDutyBtn").addEventListener("click", () => openDutyDialog());
$("#jumpToTimelineBtn").addEventListener("click", () => $("#timelineSection").scrollIntoView({ behavior:"smooth" }));
$("#closeDutyBtn").addEventListener("click", () => $("#dutyDialog").close());
$("#cancelDutyBtn").addEventListener("click", () => $("#dutyDialog").close());
$("#closeEventEditBtn").addEventListener("click", () => $("#eventEditDialog").close());
$("#cancelEventEditBtn").addEventListener("click", () => $("#eventEditDialog").close());

$("#timelineList").addEventListener("click", event => {
  const button = event.target.closest("[data-edit-kind]");
  if (!button) return;
  if (button.dataset.editKind === "duty") {
    const duty = duties.find(d => d.id === button.dataset.editId);
    if (duty) openDutyDialog(duty);
  } else {
    openEventDialog(button.dataset.editId);
  }
});

$("#dutyForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!approvedUser || !db) return;
  const date = $("#dutyDateInput").value;
  if (!date) return;
  await setDoc(dutyDocument(date), {
    date,
    hoved:$("#hovedInput").value.trim(),
    junior:$("#juniorInput").value.trim(),
    aspirant:$("#aspirantInput").value.trim(),
    styre:$("#styreInput").value.trim(),
    updatedAt:serverTimestamp(),
    updatedBy:currentUser?.uid || null
  }, { merge:true });
  $("#dutyDialog").close();
  await loadPrivateData();
});

$("#eventEditForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!approvedUser || !db) return;
  const eventId = $("#eventIdInput").value;
  await setDoc(eventDocument(eventId), {
    eventId,
    date:$("#eventDateInput").value || "",
    time:$("#eventTimeInput").value.trim(),
    title:$("#eventTitleInput").value.trim(),
    details:$("#eventDetailsInput").value.trim(),
    hoved:$("#eventHovedInput").value.trim(),
    junior:$("#eventJuniorInput").value.trim(),
    aspirant:$("#eventAspirantInput").value.trim(),
    styre:$("#eventStyreInput").value.trim(),
    komite:$("#eventKomiteInput").value.trim(),
    mat:$("#eventMatInput").value.trim(),
    updatedAt:serverTimestamp(),
    updatedBy:currentUser?.uid || null
  }, { merge:true });
  $("#eventEditDialog").close();
  await loadPrivateData();
});

$("#importDutyBtn").addEventListener("click", () => { $("#importForm").reset(); $("#importResult").textContent=""; $("#importDialog").showModal(); });
$("#importEventBtn").addEventListener("click", () => { $("#eventImportForm").reset(); $("#eventImportResult").textContent=""; $("#eventImportDialog").showModal(); });
$("#closeImportBtn").addEventListener("click", () => $("#importDialog").close());
$("#cancelImportBtn").addEventListener("click", () => $("#importDialog").close());
$("#closeEventImportBtn").addEventListener("click", () => $("#eventImportDialog").close());
$("#cancelEventImportBtn").addEventListener("click", () => $("#eventImportDialog").close());

$("#importForm").addEventListener("submit", async event => {
  event.preventDefault();
  const parsed = parseRows($("#importText").value, 5);
  if (parsed.errors.length) return $("#importResult").textContent = parsed.errors.join(" ");
  const batch = writeBatch(db);
  parsed.rows.forEach(([date,hoved,junior,aspirant,styre]) => batch.set(dutyDocument(date), { date,hoved,junior,aspirant,styre,updatedAt:serverTimestamp(),updatedBy:currentUser?.uid || null }, { merge:true }));
  await batch.commit();
  $("#importResult").textContent = `${parsed.rows.length} vaktdatoer importert.`;
  await loadPrivateData();
});

$("#eventImportForm").addEventListener("submit", async event => {
  event.preventDefault();
  const parsed = parseRows($("#eventImportText").value, 7);
  if (parsed.errors.length) return $("#eventImportResult").textContent = parsed.errors.join(" ");
  const valid = new Set(BASE_EVENTS.map(e => e.id));
  const bad = parsed.rows.find(([eventId]) => !valid.has(eventId));
  if (bad) return $("#eventImportResult").textContent = `Ukjent arrangement-id: ${bad[0]}`;
  const batch = writeBatch(db);
  parsed.rows.forEach(([eventId,hoved,junior,aspirant,styre,komite,mat]) => batch.set(eventDocument(eventId), { eventId,hoved,junior,aspirant,styre,komite,mat,updatedAt:serverTimestamp(),updatedBy:currentUser?.uid || null }, { merge:true }));
  await batch.commit();
  $("#eventImportResult").textContent = `${parsed.rows.length} arrangement oppdatert.`;
  await loadPrivateData();
});

if (!firebaseReady) {
  $("#loginBtn").disabled = true;
  $("#logoutBtn").hidden = true;
  setAuthStatus("Firebase-konfigurasjonen mangler.", "warning");
  render();
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    approvedUser = false;
    currentRole = null;
    duties = makeDefaultDuties();
    eventDocs = new Map();
    $("#loginBtn").hidden = Boolean(user);
    $("#logoutBtn").hidden = !user;
    if (!user) {
      setAuthStatus("Logg inn for å se vakter og redigere terminlista.");
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
