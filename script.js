"use strict";

const grid = document.getElementById('cert-grid');
const filterContainer = document.getElementById('filter-container');
const dialog = document.getElementById('cert-dialog');
const closeBtn = document.getElementById('close-dialog');
const dlgPreview = document.getElementById('dialog-preview');
const dlgBadge = document.getElementById('dialog-badge');
const dlgTitle = document.getElementById('dialog-title');
const dlgAbout = document.getElementById('dialog-about');
const dlgIssuer = document.getElementById('dialog-issuer');
const dlgDate = document.getElementById('dialog-date');
const dlgDownload = document.getElementById('dialog-download');

let allCerts = [];
let activeFilter = 'All';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  setupDialogClose();
}

async function loadData() {
  try {
    const res = await fetch('certificates.json');
    if (!res.ok) throw new Error("Network response was not ok.");
    let certs = await res.json();
    
    // Honor local modifications (from admin add.html layer)
    const extraCerts = JSON.parse(localStorage.getItem("extra_certs") || "[]");
    if (extraCerts.length > 0) {
      const existingIds = new Set(certs.map(c => c.id));
      const newOnes = extraCerts.filter(c => !existingIds.has(c.id));
      certs = [...certs, ...newOnes];
    }
    
    // Honor local deletions
    const deletedIds = new Set(JSON.parse(localStorage.getItem("deleted_cert_ids") || "[]"));
    if (deletedIds.size > 0) {
      certs = certs.filter(c => !deletedIds.has(c.id));
    }
    
    // Sort array so newest comes first if desired, or leave as JSON order
    allCerts = certs;
    
    buildFilters();
    renderCards(allCerts);
  } catch (err) {
    console.error("Failed to load certificates:", err);
    grid.innerHTML = `<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 4rem;">
      Unable to load certificates. Please run this via a local web server to fetch JSON.
    </p>`;
  }
}

function buildFilters() {
  // Capture unique categories
  const categories = ['All', ...new Set(allCerts.map(c => c.category))];
  filterContainer.innerHTML = '';
  
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `filter-btn ${cat === activeFilter ? 'active' : ''}`;
    btn.textContent = cat;
    
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = cat;
      const filtered = cat === 'All' ? allCerts : allCerts.filter(c => c.category === cat);
      renderCards(filtered);
    });
    
    filterContainer.appendChild(btn);
  });
}

function renderCards(certs) {
  grid.innerHTML = '';
  
  if (certs.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 4rem;">
      No certificates match your criteria.
    </p>`;
    return;
  }
  
  certs.forEach((cert, idx) => {
    const card = document.createElement('div');
    card.className = 'cert-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    // Staggered entrance animation delay
    card.style.transitionDelay = `${(idx % 8) * 40}ms`;
    
    const fileSrc = encodeURI(cert.image || cert.download || '');
    const isPDF = fileSrc.toLowerCase().endsWith('.pdf');
    const embedHtml = isPDF 
      ? `<embed class="card-embed" src="${fileSrc}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" type="application/pdf" />`
      : `<img class="card-embed" src="${fileSrc}" alt="${cert.title}" loading="lazy" />`;
    
    card.innerHTML = `
      <div class="card-thumb">
        ${embedHtml}
        <div class="card-overlay">
          <div class="card-overlay-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Review Details
          </div>
        </div>
      </div>
      <div class="card-body">
        <span class="card-tag">${cert.category}</span>
        <h3 class="card-title">${cert.title}</h3>
        <div class="card-issuer">${cert.issuer}</div>
      </div>
    `;
    
    // Interactions
    card.addEventListener('click', () => openDialog(cert));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDialog(cert);
      }
    });
    
    // Dynamic 3D Tilt Effect
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -6; // Max 6 deg tilt
      const rotateY = ((x - centerX) / centerX) * 6;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    });
    
    grid.appendChild(card);
  });
  
  // Trigger Intersection Observer for fresh cards
  observeCards();
}

function observeCards() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Add class to trigger CSS transition 
        requestAnimationFrame(() => {
          entry.target.classList.add('visible');
        });
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: "0px 0px 50px 0px" });
  
  document.querySelectorAll('.cert-card').forEach(c => io.observe(c));
}

// Dialog Handling
function openDialog(cert) {
  dlgBadge.textContent = cert.category;
  dlgTitle.textContent = cert.title;
  dlgAbout.textContent = cert.about || "Demonstrated professional competency and core skills within the specified domain.";
  dlgIssuer.textContent = cert.issuer;
  dlgDate.textContent = cert.date;
  
  const fileUrl = encodeURI(cert.download || cert.image || '');
  dlgDownload.href = fileUrl;
  dlgDownload.download = cert.title;
  
  const isPDF = fileUrl.toLowerCase().endsWith('.pdf');
  dlgPreview.innerHTML = isPDF 
    ? `<embed src="${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" type="application/pdf" />`
    : `<img src="${fileUrl}" alt="${cert.title}" />`;
    
  dialog.showModal();
  document.body.style.overflow = 'hidden'; // Lock background scrolling
}

function setupDialogClose() {
  closeBtn.addEventListener('click', closeAnim);
  
  // Close on clicking the backdrop (native backdrop clicks target the dialog element itself)
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      closeAnim();
    }
  });

  // Handle native ESC cleanly with animation
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault(); // Stop immediate native close
    closeAnim();
  });
}

function closeAnim() {
  dialog.classList.add('closing');
  // Wait for CSS animation to finish before truly closing
  setTimeout(() => {
    dialog.close();
    dialog.classList.remove('closing');
    dlgPreview.innerHTML = ''; // Keep memory lean on close
    document.body.style.overflow = '';
  }, 400); // 400ms matches CSS transition
}
