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
    
    const fileSrc = encodeURI(cert.image || '');
    const embedHtml = `<img class="card-embed" src="${fileSrc}" alt="${cert.title}" loading="lazy" />`;
    
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
  
  const fileUrl = encodeURI(cert.image || '');
  const pdfUrl = encodeURI(cert.download || '');
  dlgDownload.href = pdfUrl;
  dlgDownload.download = cert.title;
  
  dlgPreview.innerHTML = `<img src="${fileUrl}" alt="${cert.title}" />`;
    
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

/* ══════════════════════════════════════════════════════════════
   3D SPACE ENGINE (THREE.JS) - PORTFOLIO MATCH
══════════════════════════════════════════════════════════════ */
let mX = window.innerWidth / 2;
let mY = window.innerHeight / 2;
document.addEventListener('mousemove', e => { mX = e.clientX; mY = e.clientY; });

function initSpaceEngine() {
  if (typeof THREE === 'undefined') return;

  const sc = new THREE.Scene();
  sc.fog = new THREE.FogExp2(0x020205, 0.0035);
  const cam = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
  const rend = new THREE.WebGLRenderer({
    canvas: document.getElementById('webgl-canvas'),
    alpha: true,
    antialias: true
  });
  rend.setSize(window.innerWidth, window.innerHeight);
  rend.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // 1. Starfield
  const sGeo = new THREE.BufferGeometry();
  const sCount = window.innerWidth > 768 ? 4000 : 1500;
  const pos = new Float32Array(sCount * 3), col = new Float32Array(sCount * 3);
  for (let i = 0; i < sCount * 3; i += 3) {
    pos[i] = (Math.random() - 0.5) * 300;
    pos[i + 1] = (Math.random() - 0.5) * 300;
    pos[i + 2] = (Math.random() - 0.5) * 300 - 50;
    let rng = Math.random();
    if (rng > 0.85) { col[i] = 0; col[i + 1] = 0.96; col[i + 2] = 1; }
    else if (rng > 0.7) { col[i] = 0.54; col[i + 1] = 0.36; col[i + 2] = 0.96; }
    else if (rng > 0.55) { col[i] = 1; col[i + 1] = 0.16; col[i + 2] = 0.52; }
    else { col[i] = 1; col[i + 1] = 1; col[i + 2] = 1; }
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 16, 16);
  const starTex = new THREE.CanvasTexture(cv);

  const sMat = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, map: starTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const starMesh = new THREE.Points(sGeo, sMat);
  sc.add(starMesh);

  const objs = [];
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, opacity: 1, metalness: 0.2, roughness: 0.1, ior: 1.5 });
  const wireM = new THREE.MeshBasicMaterial({ color: 0x00f5ff, wireframe: true, transparent: true, opacity: 0.2 });
  for (let i = 0; i < 30; i++) {
    let isGeo = Math.random() > 0.5 ? new THREE.IcosahedronGeometry(Math.random() * 1.5 + 0.5, 0) : new THREE.TorusGeometry(Math.random() * 1.5 + 0.5, 0.4, 16, 32);
    let m = new THREE.Mesh(isGeo, Math.random() > 0.6 ? wireM : glassM);
    m.position.set((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 200 - 80);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    m.userData = { rx: (Math.random() - 0.5) * 0.015, ry: (Math.random() - 0.5) * 0.015, zBase: m.position.z };
    sc.add(m); objs.push(m);
  }

  const nGeo = new THREE.BufferGeometry();
  const nPos = new Float32Array(500 * 3);
  for (let i = 0; i < 1500; i += 3) { nPos[i] = (Math.random() - 0.5) * 150; nPos[i + 1] = (Math.random() - 0.5) * 150; nPos[i + 2] = (Math.random() - 0.5) * 100 - 50; }
  nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  const nMat = new THREE.PointsMaterial({ size: 30, color: 0x8b5cf6, map: starTex, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false });
  const nebMesh = new THREE.Points(nGeo, nMat);
  sc.add(nebMesh);

  sc.add(new THREE.AmbientLight(0xffffff, 0.1));
  const l1 = new THREE.PointLight(0x00f5ff, 2, 200); l1.position.set(20, 20, 10); sc.add(l1);
  const l2 = new THREE.PointLight(0x8b5cf6, 2, 200); l2.position.set(-20, -20, -10); sc.add(l2);

  window.addEventListener('resize', () => { cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix(); rend.setSize(window.innerWidth, window.innerHeight); });

  let tX3 = 0, tY3 = 0, sY = 0;
  function anim3D() {
    requestAnimationFrame(anim3D);
    tX3 = (mX - window.innerWidth / 2) * 0.005;
    tY3 = (mY - window.innerHeight / 2) * 0.005;
    cam.position.x += (tX3 - cam.position.x) * 0.05;
    cam.position.y += (-tY3 - cam.position.y) * 0.05;
    sY += (window.scrollY * (-0.02) - cam.position.z) * 0.1;
    cam.position.z = sY + 15;
    cam.lookAt(sc.position);
    starMesh.rotation.y = Date.now() * 0.00005;
    objs.forEach(o => { o.rotation.x += o.userData.rx; o.rotation.y += o.userData.ry; if (o.position.z < o.userData.zBase) o.position.z += 0.1; });
    rend.render(sc, cam);
  }
  anim3D();
}

document.addEventListener('DOMContentLoaded', () => { setTimeout(initSpaceEngine, 200); });
