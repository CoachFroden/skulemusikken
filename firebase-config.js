// Firebase Web-konfigurasjon for prosjektet «Samnanger skulemusikklag».
// Firebase web-config er offentlig klientkonfigurasjon. Tilgang til privat data
// styres av Firebase Authentication og Firestore security rules.
window.SKULEMUSIKKEN_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBWsleL1F082y5dTsp2vnTe2LroXpoBSeE",
  authDomain: "samnanger-skulemusikklag.firebaseapp.com",
  projectId: "samnanger-skulemusikklag",
  storageBucket: "samnanger-skulemusikklag.firebasestorage.app",
  messagingSenderId: "1091683313021",
  appId: "1:1091683313021:web:fb43407e195744c8759814"
};

// UI-hjelper: punktet som allerede vises som «Neste på terminlista» skal ikke
// gjentas i selve terminlisten. Beholder samtidig redigeringsmuligheten i toppkortet.
(() => {
  let syncQueued = false;

  function normalize(value = "") {
    return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("nb-NO");
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncFeaturedTimelineItem();
    });
  }

  function syncFeaturedTimelineItem() {
    const nextTitle = document.querySelector("#nextItemTitle");
    const timeline = document.querySelector("#timelineList");
    const hero = document.querySelector("#nextSection .hero-main");
    if (!nextTitle || !timeline || !hero) return;

    const featuredKey = normalize(nextTitle.textContent);
    let matchingCard = null;

    timeline.querySelectorAll(".timeline-card").forEach(card => {
      const date = card.querySelector(".timeline-date")?.textContent || "";
      const type = card.querySelector(".timeline-type")?.textContent || "";
      const cardKey = normalize(`${date} · ${type}`);
      const isFeatured = Boolean(featuredKey) && cardKey === featuredKey;
      card.hidden = isFeatured;
      if (isFeatured) matchingCard = card;
    });

    let heroEdit = document.querySelector("#featuredEditBtn");
    const sourceEdit = matchingCard?.querySelector("[data-edit-kind]");

    if (sourceEdit) {
      if (!heroEdit) {
        heroEdit = document.createElement("button");
        heroEdit.id = "featuredEditBtn";
        heroEdit.type = "button";
        heroEdit.textContent = "Rediger";
        heroEdit.setAttribute("aria-label", "Rediger neste punkt");
        Object.assign(heroEdit.style, {
          marginTop: "14px",
          minHeight: "40px",
          padding: "8px 14px",
          borderRadius: "11px",
          border: "1px solid rgba(255,255,255,.35)",
          background: "rgba(255,255,255,.08)",
          color: "#fff",
          font: "inherit",
          fontWeight: "750",
          cursor: "pointer"
        });
        hero.appendChild(heroEdit);
      }
      heroEdit.onclick = () => sourceEdit.click();
      heroEdit.hidden = false;
    } else if (heroEdit) {
      heroEdit.hidden = true;
    }

    // Skjul månedstittel dersom det skjulte punktet var månedens eneste synlige kort.
    timeline.querySelectorAll(".month-heading").forEach(heading => {
      let node = heading.nextElementSibling;
      let hasVisibleCard = false;
      while (node && !node.classList.contains("month-heading")) {
        if (node.classList.contains("timeline-card") && !node.hidden) {
          hasVisibleCard = true;
          break;
        }
        node = node.nextElementSibling;
      }
      heading.hidden = !hasVisibleCard;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    queueSync();
    const timeline = document.querySelector("#timelineList");
    const nextTitle = document.querySelector("#nextItemTitle");
    if (timeline) new MutationObserver(queueSync).observe(timeline, { childList: true, subtree: true });
    if (nextTitle) new MutationObserver(queueSync).observe(nextTitle, { childList: true, subtree: true, characterData: true });
  });
})();
