/**
 * script.js — Anandhu Pradeep · Certificate Gallery
 * ─────────────────────────────────────────────────────────────
 * Features:
 *  • Fetch certificate data from certificates.json
 *  • Build responsive gallery cards dynamically
 *  • Category filter bar
 *  • Fullscreen dialog: open / close with animations
 *  • ESC key to close dialog
 *  • Swipe-down to close on mobile
 *  • Scroll-triggered card fade-in (IntersectionObserver)
 *  • Animated stat counters
 */

"use strict";

/* ─── Category config ───────────────────────────────────────────────────────
   Each category has an emoji icon and a CSS gradient for the card stripe.
   Keys must match the `category` field in certificates.json exactly.         */
const CAT_CONFIG = {
  "Programming":               { icon: "💻", stripe: "linear-gradient(90deg,#38bdf8,#818cf8)" },
  "Web Development":           { icon: "🌐", stripe: "linear-gradient(90deg,#34d399,#22d3ee)" },
  "Database":                  { icon: "🗄️", stripe: "linear-gradient(90deg,#f472b6,#fb7185)" },
  "Cloud":                     { icon: "☁️", stripe: "linear-gradient(90deg,#22d3ee,#38bdf8)" },
  "System Administration":     { icon: "⚙️", stripe: "linear-gradient(90deg,#94a3b8,#cbd5e1)" },
  "Data Analysis":             { icon: "📊", stripe: "linear-gradient(90deg,#a78bfa,#c084fc)" },
  "Project Management":        { icon: "📋", stripe: "linear-gradient(90deg,#34d399,#10b981)" },
  "Business & Administration": { icon: "📈", stripe: "linear-gradient(90deg,#fbbf24,#f59e0b)" },
  "Mobile Development":        { icon: "📱", stripe: "linear-gradient(90deg,#fbbf24,#f97316)" },
  "Computer Science":          { icon: "🧮", stripe: "linear-gradient(90deg,#f87171,#fb923c)" },
  "Hackathon":                 { icon: "🚀", stripe: "linear-gradient(90deg,#c084fc,#a78bfa)" },
  "Education":                 { icon: "🎓", stripe: "linear-gradient(90deg,#facc15,#eab308)" },
};

/* Default for unknown categories */
const DEFAULT_CAT = { icon: "📄", stripe: "linear-gradient(90deg,#60a5fa,#a78bfa)" };

/* ─── DOM refs ──────────────────────────────────────────────────────────────*/
const grid        = document.getElementById("cert-grid");
const loader      = document.getElementById("loader");
const emptyState  = document.getElementById("empty-state");
const filterBar   = document.getElementById("filter-bar");

/* Stats */
const sTotal   = document.getElementById("s-total");
const sCats    = document.getElementById("s-cats");
const sIssuers = document.getElementById("s-issuers");

/* Dialog */
const overlay    = document.getElementById("dialog-overlay");
const panel      = document.getElementById("dialog-panel");
const btnBack    = document.getElementById("btn-back");
const dlgBadge   = document.getElementById("dlg-badge");
const dlgPreview = document.getElementById("dlg-preview");
const dlgTitle   = document.getElementById("dlg-title");
const dlgAbout   = document.getElementById("dlg-about");
const dlgIssuer  = document.getElementById("dlg-issuer");
const dlgDate    = document.getElementById("dlg-date");
const dlgDl      = document.getElementById("dlg-download");

/* ─── State ─────────────────────────────────────────────────────────────────*/
let allCerts    = [];
let activeFilter = "All";

/* ─── Boot ──────────────────────────────────────────────────────────────────*/
document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupDialogEvents();
  await loadCerts();
}

/* ══════════════════════════════════════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════════════════════════════════════ */

/**
 * Fetch certificates.json and render everything.
 */
async function loadCerts() {
  try {
    const res = await fetch("certificates.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allCerts = await res.json();

    /* ── Merge locally-added certs (from add.html admin tool) ── */
    const extraCerts = JSON.parse(localStorage.getItem("extra_certs") || "[]");
    if (extraCerts.length > 0) {
      const existingIds = new Set(allCerts.map(c => c.id));
      const newOnes     = extraCerts.filter(c => !existingIds.has(c.id));
      allCerts = [...allCerts, ...newOnes];
    }

    /* ── Remove certs deleted via the admin Delete tab ── */
    const deletedIds = new Set(JSON.parse(localStorage.getItem("deleted_cert_ids") || "[]"));
    if (deletedIds.size > 0) {
      allCerts = allCerts.filter(c => !deletedIds.has(c.id));
    }

    setStats(allCerts);
    buildFilterBar(allCerts);
    renderCards(allCerts);
  } catch (err) {
    console.error("Could not load certificates:", err);
    loader.innerHTML = `
      <span style="font-size:2.5rem">⚠️</span>
      <p style="color:#f87171;font-size:.9rem;max-width:360px;text-align:center">
        Could not load <code>certificates.json</code>.<br>
        Please open this page via a local server (e.g. VS Code Live Server).
      </p>`;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════════════════════════ */

function setStats(certs) {
  const categories = new Set(certs.map(c => c.category));
  const issuers    = new Set(certs.map(c => c.issuer));

  animateCount(sTotal,   certs.length);
  animateCount(sCats,    categories.size);
  animateCount(sIssuers, issuers.size);
}

/** Smooth number count-up animation */
function animateCount(el, target) {
  const duration = 1000;
  const start    = performance.now();
  const tick     = now => {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(p * target);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════════════════════════════════
   FILTER BAR
══════════════════════════════════════════════════════════════════════════ */

function buildFilterBar(certs) {
  /* Unique category list; preserve insertion order */
  const categories = ["All", ...new Set(certs.map(c => c.category))];

  filterBar.innerHTML = "";

  categories.forEach(cat => {
    const cfg = CAT_CONFIG[cat] || DEFAULT_CAT;
    const isAll = cat === "All";

    const btn = document.createElement("button");
    /* Give the "All" button its own CSS class for distinct styling */
    btn.className   = "filter-btn" + (isAll ? " all-btn active" : "");
    btn.dataset.cat = cat;
    btn.setAttribute("aria-pressed", isAll ? "true" : "false");

    const count = isAll
      ? certs.length
      : certs.filter(c => c.category === cat).length;

    btn.textContent = isAll
      ? `✦ All Certificates (${count})`
      : `${cfg.icon} ${cat} (${count})`;

    btn.addEventListener("click", () => onFilterClick(btn, cat));
    filterBar.appendChild(btn);
  });
}

function onFilterClick(btn, cat) {
  /* Deactivate all buttons — but keep the all-btn class on the "All" button */
  filterBar.querySelectorAll(".filter-btn").forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });
  btn.classList.add("active");
  btn.setAttribute("aria-pressed", "true");

  activeFilter = cat;
  const filtered = cat === "All"
    ? allCerts
    : allCerts.filter(c => c.category === cat);

  renderCards(filtered);
}

/* ══════════════════════════════════════════════════════════════════════════
   CARD RENDERING
══════════════════════════════════════════════════════════════════════════ */

function renderCards(certs) {
  /* Reset */
  grid.innerHTML   = "";
  loader.style.display     = "none";
  emptyState.hidden        = certs.length > 0;
  grid.hidden              = certs.length === 0;

  if (certs.length === 0) return;

  certs.forEach((cert, idx) => {
    const card = buildCard(cert, idx);
    grid.appendChild(card);
  });

  /* Trigger scroll-based fade-in */
  initScrollObserver();
}

/** Build one card element */
function buildCard(cert, idx) {
  const cfg   = CAT_CONFIG[cert.category] || DEFAULT_CAT;

  const card  = document.createElement("article");
  card.className = "cert-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `View certificate: ${cert.title}`);
  /* Stagger entrance delay slightly */
  card.style.transitionDelay = `${(idx % 4) * 55}ms`;

  /* ── Thumbnail ── */
  const thumb = document.createElement("div");
  thumb.className = "card-thumb";
  /* Category colour stripe via CSS custom property */
  thumb.style.setProperty("--card-stripe", cfg.stripe);

  /* Try PDF embed */
  const embed = document.createElement("embed");
  embed.src     = encodeURI(cert.image) + "#toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=90";
  embed.type    = "application/pdf";
  embed.title   = cert.title;
  embed.setAttribute("aria-hidden", "true"); /* decorative thumbnail */

  /* Fallback icon — shown when embed fails */
  const fallback = document.createElement("div");
  fallback.className  = "thumb-fallback";
  fallback.style.display = "none";
  fallback.innerHTML  = `
    <span class="f-icon">${cfg.icon}</span>
    <span class="f-cat">${cert.category}</span>`;

  embed.addEventListener("error", () => {
    embed.style.display = "none";
    fallback.style.display = "flex";
  });

  /* Hover overlay */
  const overlay = document.createElement("div");
  overlay.className = "card-thumb-overlay";
  overlay.innerHTML = `
    <div class="overlay-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      View
    </div>`;

  thumb.appendChild(embed);
  thumb.appendChild(fallback);
  thumb.appendChild(overlay);

  /* ── Card body ── */
  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <span class="card-cat-badge">${cfg.icon} ${cert.category}</span>
    <h2 class="card-title">${escHtml(cert.title)}</h2>
    <p  class="card-issuer">${escHtml(cert.issuer)} · ${escHtml(cert.date)}</p>`;

  card.appendChild(thumb);
  card.appendChild(body);

  /* Open dialog on click or Enter/Space */
  card.addEventListener("click",   () => openDialog(cert));
  card.addEventListener("keydown",  e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDialog(cert); }
  });

  return card;
}

/* ══════════════════════════════════════════════════════════════════════════
   DIALOG — Open / Close
══════════════════════════════════════════════════════════════════════════ */

/** Populate and open the fullscreen dialog for one certificate */
function openDialog(cert) {
  const cfg = CAT_CONFIG[cert.category] || DEFAULT_CAT;

  /* ── Populate data ── */
  dlgBadge.textContent  = `${cfg.icon} ${cert.category}`;
  dlgTitle.textContent  = cert.title;
  dlgAbout.textContent  = cert.about || "No description available.";
  dlgIssuer.textContent = cert.issuer;
  dlgDate.textContent   = cert.date;
  dlgDl.href            = encodeURI(cert.download);
  dlgDl.download        = cert.title + ".pdf";

  /* ── PDF embed in dialog ── */
  dlgPreview.innerHTML = ""; // clear previous

  const embed = document.createElement("embed");
  embed.src   = encodeURI(cert.image) + "#toolbar=0&navpanes=0&scrollbar=0&view=FitH";
  embed.type  = "application/pdf";
  embed.title = cert.title;

  /* Fallback when PDF can't render (mobile / no plugin) */
  const fb = document.createElement("div");
  fb.className = "dlg-fallback";
  fb.style.display = "none";
  fb.innerHTML = `
    <span class="df-icon">${cfg.icon}</span>
    <p class="df-msg">PDF preview not available in this browser.<br>
    Use the download button below to open the certificate.</p>`;

  embed.addEventListener("error", () => {
    embed.style.display = "none";
    fb.style.display = "flex";
  });

  dlgPreview.appendChild(embed);
  dlgPreview.appendChild(fb);

  /* ── Open overlay ── */
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden"; // prevent background scroll

  /* Focus back button for keyboard accessibility */
  setTimeout(() => btnBack.focus(), 50);
}

/** Close the dialog smoothly */
function closeDialog() {
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  /* Clean up embed after animation to free memory */
  setTimeout(() => { dlgPreview.innerHTML = ""; }, 450);
}

/* ── Dialog event wiring ──────────────────────────────────────────────────── */

function setupDialogEvents() {
  /* Back button */
  btnBack.addEventListener("click", closeDialog);

  /* Click backdrop (outside panel) to close */
  overlay.addEventListener("click", e => {
    if (!panel.contains(e.target)) closeDialog();
  });

  /* ESC key */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeDialog();
  });

  /* ── Mobile swipe-down to close ────────────────────────────────────────── */
  let touchStartY = 0;
  let touchCurY   = 0;

  panel.addEventListener("touchstart", e => {
    touchStartY = e.touches[0].clientY;
    touchCurY   = touchStartY;
    panel.style.transition = "none"; // disable transition while dragging
  }, { passive: true });

  panel.addEventListener("touchmove", e => {
    touchCurY = e.touches[0].clientY;
    const delta = touchCurY - touchStartY;
    if (delta > 0) {
      /* Drag downward */
      panel.style.transform = `translateY(${delta}px)`;
    }
  }, { passive: true });

  panel.addEventListener("touchend", () => {
    panel.style.transition = ""; // restore transition
    const delta = touchCurY - touchStartY;
    if (delta > 120) {
      /* Swiped down enough — close */
      closeDialog();
    } else {
      /* Snap back */
      panel.style.transform = "";
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   SCROLL FADE-IN (IntersectionObserver)
══════════════════════════════════════════════════════════════════════════ */

function initScrollObserver() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        io.unobserve(entry.target); // animate once only
      }
    });
  }, { threshold: 0.07 });

  document.querySelectorAll(".cert-card").forEach(c => io.observe(c));
}

/* ══════════════════════════════════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════════════════════════════════ */

/** Escape HTML to prevent XSS when injecting user data */
function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}
