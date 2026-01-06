// ==========================
// INIT MAP
// ==========================
const map = L.map("map").setView([0.52, 101.45], 8);

// ==========================
// PANE (URUTAN LAYER)
// ==========================
map.createPane("panePolygon");
map.getPane("panePolygon").style.zIndex = 200;

map.createPane("paneBoundary");
map.getPane("paneBoundary").style.zIndex = 300;

map.createPane("panePoint");
map.getPane("panePoint").style.zIndex = 500;

// ==========================
// BASEMAP
// ==========================
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
}).addTo(map);

const cartoLight = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  { maxZoom: 20 }
);

const cartoDark = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  { maxZoom: 20 }
);

let currentBasemap = osm;
document.getElementById("basemap-select").onchange = function () {
  map.removeLayer(currentBasemap);
  currentBasemap =
    this.value === "carto-light"
      ? cartoLight
      : this.value === "carto-dark"
      ? cartoDark
      : osm;
  currentBasemap.addTo(map);
};

// ==========================
// LAYER GROUPS
// ==========================
const layerPolygon = L.layerGroup({ pane: "panePolygon" }).addTo(map);
const layerBoundary = L.layerGroup({ pane: "paneBoundary" }).addTo(map);

const layerBor = L.layerGroup({ pane: "panePoint" }).addTo(map);
const layerGali = L.layerGroup({ pane: "panePoint" }).addTo(map);

const layerRisikoTinggi = L.layerGroup({ pane: "panePoint" }).addTo(map);
const layerRisikoSedang = L.layerGroup({ pane: "panePoint" }).addTo(map);
const layerRisikoRendah = L.layerGroup({ pane: "panePoint" }).addTo(map);

// ==========================
// HELPER FUNCTIONS
// ==========================
function interpolateColor(value, min, max) {
  const t = (value - min) / (max - min || 1);
  const r = Math.round(255 * (1 - t) + 50 * t);
  const g = Math.round(230 * (1 - t) + 100 * t);
  const b = Math.round(150 * (1 - t) + 255 * t);
  return `rgb(${r},${g},${b})`;
}

function hitungRisiko(septic, selokan) {
  if (septic <= 10 || selokan <= 10) return "Tinggi";
  if (septic <= 20 || selokan <= 20) return "Sedang";
  return "Rendah";
}

function warnaRisiko(r) {
  if (r === "Tinggi") return "#ef4444";
  if (r === "Sedang") return "#facc15";
  return "#22c55e";
}

// Ambil angka pH untuk filter (support: "<7", ">7", "7", "6.5")
function parsePHNumeric(ph) {
  if (ph === null || ph === undefined) return null;

  const s = String(ph).trim().replace(",", ".");
  if (!s) return null;

  if (s.startsWith("<")) {
    const n = Number(s.slice(1).trim());
    return Number.isFinite(n) ? n - 0.1 : null;
  }
  if (s.startsWith(">")) {
    const n = Number(s.slice(1).trim());
    return Number.isFinite(n) ? n + 0.1 : null;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function readNumber(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const v = String(el.value ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badgeClass(r) {
  if (r === "Tinggi") return "high";
  if (r === "Sedang") return "med";
  return "low";
}

function toGmapsLink(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ==========================
// STATE
// ==========================
const wells = []; // { marker, circle, isBor, risiko, phNum, septic, selokan, props, latlng, visible }
let initialBounds = null;
let locateLayer = null;

// ==========================
// ICONS
// ==========================
const iconBor = L.AwesomeMarkers.icon({
  icon: "tint",
  markerColor: "blue",
  prefix: "fa",
});

const iconGali = L.AwesomeMarkers.icon({
  icon: "tint",
  markerColor: "cadetblue",
  prefix: "fa",
});

// ==========================
// MINI LEGEND CONTROL (Leaflet)
// ==========================
const legendCtrl = L.control({ position: "bottomright" });
legendCtrl.onAdd = function () {
  const div = L.DomUtil.create("div", "legend-mini");
  div.innerHTML = `
    <b>Legenda Risiko</b>
    <div class="row"><span class="sw high"></span><span> Tinggi</span></div>
    <div class="row"><span class="sw med"></span><span> Sedang</span></div>
    <div class="row"><span class="sw low"></span><span> Rendah</span></div>
  `;
  return div;
};
legendCtrl.addTo(map);

// ==========================
// LOAD POLYGON RIAU
// ==========================
fetch("data/polygon_riau.json")
  .then((r) => r.json())
  .then((data) => {
    const vals = data.features.map((f) => f.properties?.OBJECTID ?? 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    const poly = L.geoJSON(data, {
      pane: "panePolygon",
      style: (f) => ({
        fillColor: interpolateColor(f.properties?.OBJECTID ?? 0, min, max),
        fillOpacity: 0.78,
        color: "transparent",
        weight: 0,
      }),
    }).addTo(layerPolygon);

    L.geoJSON(data, {
      pane: "paneBoundary",
      style: {
        color: "#1e293b",
        weight: 0.8,
        fillOpacity: 0,
      },
    }).addTo(layerBoundary);

    initialBounds = poly.getBounds();
    map.fitBounds(initialBounds, { padding: [24, 24] });
  });

// ==========================
// LOAD DATA SUMUR
// ==========================
let total = 0,
  bor = 0,
  gali = 0;

fetch("data/kualitas_air_sumur.json")
  .then((r) => r.json())
  .then((data) => {
    L.geoJSON(data, {
      pointToLayer: (f, latlng) => {
        const p = f.properties || {};
        total++;

        const jenis = String(p.jenis_sumur || "").toLowerCase();
        const isBor = jenis.includes("bor");
        if (isBor) bor++;
        else gali++;

        const septic = Number(p.jarak_septictank_m);
        const selokan = Number(p.jarak_selokan_m);

        const septicSafe = Number.isFinite(septic) ? septic : 999999;
        const selokanSafe = Number.isFinite(selokan) ? selokan : 999999;

        const risiko = hitungRisiko(septicSafe, selokanSafe);

        const marker = L.marker(latlng, { icon: isBor ? iconBor : iconGali });
        const circle = L.circleMarker(latlng, {
          radius: 9,
          color: warnaRisiko(risiko),
          weight: 2,
          fillOpacity: 0.45,
        });

        // Popup card
        const lat = Number(latlng.lat);
        const lng = Number(latlng.lng);
        const gmaps = toGmapsLink(lat, lng);

        const idSumur = p.id_sumur ?? p.ID ?? p.id ?? "-";
        const kec = p.kecamatan ?? "-";

        marker.bindPopup(`
          <div class="popup-card">
            <div class="popup-title">
              <div>
                <b>${esc(idSumur)}</b><br/>
                <span class="muted">${esc(kec)}</span>
              </div>
              <span class="badge-risk ${badgeClass(risiko)}">${esc(risiko)}</span>
            </div>

            <div class="popup-grid">
              <div><b>Jenis:</b> ${esc(p.jenis_sumur ?? "-")}</div>
              <div><b>pH:</b> ${esc(p.pH ?? "-")}</div>
              <div><b>Septic:</b> ${Number.isFinite(septic) ? esc(septic) : "-"} m</div>
              <div><b>Selokan:</b> ${Number.isFinite(selokan) ? esc(selokan) : "-"} m</div>
              <div><b>Bau:</b> ${esc(p.bau ?? "-")}</div>
              <div><b>Rasa:</b> ${esc(p.rasa ?? "-")}</div>
              <div><b>Koordinat:</b> <span class="mono">${lat.toFixed(6)}, ${lng.toFixed(6)}</span></div>
            </div>

            <div class="popup-actions">
              ${
                gmaps
                  ? `<a href="${gmaps}" target="_blank" rel="noreferrer"><i class="fa-solid fa-location-dot"></i> Buka di Google Maps</a>`
                  : ""
              }
            </div>
          </div>
        `);

        // Add awal tampil semua
        (isBor ? layerBor : layerGali).addLayer(marker);
        if (risiko === "Tinggi") layerRisikoTinggi.addLayer(circle);
        else if (risiko === "Sedang") layerRisikoSedang.addLayer(circle);
        else layerRisikoRendah.addLayer(circle);

        wells.push({
          marker,
          circle,
          isBor,
          risiko,
          phNum: parsePHNumeric(p.pH),
          septic: Number.isFinite(septic) ? septic : null,
          selokan: Number.isFinite(selokan) ? selokan : null,
          props: {
            id_sumur: idSumur,
            kecamatan: kec,
            jenis_sumur: p.jenis_sumur ?? null,
            pH: p.pH ?? null,
            jarak_septictank_m: Number.isFinite(septic) ? septic : null,
            jarak_selokan_m: Number.isFinite(selokan) ? selokan : null,
            bau: p.bau ?? null,
            rasa: p.rasa ?? null,
            latitude: lat,
            longitude: lng,
          },
          latlng,
          visible: true,
        });

        return marker;
      },
    });

    document.getElementById("total-sumur").textContent = String(total);
    document.getElementById("count-bor").textContent = String(bor);
    document.getElementById("count-gali").textContent = String(gali);

    applyFilters();
    hideMapLoading();
  })
  .catch(() => {
    hideMapLoading();
    window.AppUI?.toast?.("Gagal memuat data sumur", false);
  });

function hideMapLoading() {
  const el = document.getElementById("map-loading");
  if (el) el.style.display = "none";
}

// ==========================
// FILTER LOGIC
// ==========================
function applyFilters() {
  const phMin = readNumber("filter-ph-min");
  const phMax = readNumber("filter-ph-max");

  const septicMin = readNumber("filter-septic-min");
  const septicMax = readNumber("filter-septic-max");

  const selokanMin = readNumber("filter-selokan-min");
  const selokanMax = readNumber("filter-selokan-max");

  let shown = 0;

  for (const w of wells) {
    let ok = true;

    // pH
    if (phMin !== null || phMax !== null) {
      if (w.phNum === null) ok = false;
      if (ok && phMin !== null && w.phNum < phMin) ok = false;
      if (ok && phMax !== null && w.phNum > phMax) ok = false;
    }

    // septic
    if (ok && (septicMin !== null || septicMax !== null)) {
      if (w.septic === null) ok = false;
      if (ok && septicMin !== null && w.septic < septicMin) ok = false;
      if (ok && septicMax !== null && w.septic > septicMax) ok = false;
    }

    // selokan
    if (ok && (selokanMin !== null || selokanMax !== null)) {
      if (w.selokan === null) ok = false;
      if (ok && selokanMin !== null && w.selokan < selokanMin) ok = false;
      if (ok && selokanMax !== null && w.selokan > selokanMax) ok = false;
    }

    w.visible = ok;

    if (ok) {
      shown++;

      // marker jenis
      if (w.isBor) {
        if (!layerBor.hasLayer(w.marker)) layerBor.addLayer(w.marker);
        if (layerGali.hasLayer(w.marker)) layerGali.removeLayer(w.marker);
      } else {
        if (!layerGali.hasLayer(w.marker)) layerGali.addLayer(w.marker);
        if (layerBor.hasLayer(w.marker)) layerBor.removeLayer(w.marker);
      }

      // circle risiko
      layerRisikoTinggi.removeLayer(w.circle);
      layerRisikoSedang.removeLayer(w.circle);
      layerRisikoRendah.removeLayer(w.circle);

      if (w.risiko === "Tinggi") layerRisikoTinggi.addLayer(w.circle);
      else if (w.risiko === "Sedang") layerRisikoSedang.addLayer(w.circle);
      else layerRisikoRendah.addLayer(w.circle);
    } else {
      layerBor.removeLayer(w.marker);
      layerGali.removeLayer(w.marker);
      layerRisikoTinggi.removeLayer(w.circle);
      layerRisikoSedang.removeLayer(w.circle);
      layerRisikoRendah.removeLayer(w.circle);
    }
  }

  const fc = document.getElementById("filter-count");
  if (fc) fc.textContent = String(shown);
}

document.getElementById("btn-apply-filter").onclick = () => applyFilters();

document.getElementById("btn-reset-filter").onclick = () => {
  [
    "filter-ph-min",
    "filter-ph-max",
    "filter-septic-min",
    "filter-septic-max",
    "filter-selokan-min",
    "filter-selokan-max",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  applyFilters();
};

[
  "filter-ph-min",
  "filter-ph-max",
  "filter-septic-min",
  "filter-septic-max",
  "filter-selokan-min",
  "filter-selokan-max",
].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyFilters();
  });
});

// ==========================
// TOGGLES (layer)
// ==========================
document.getElementById("togglePolygon").onchange = (e) =>
  e.target.checked ? map.addLayer(layerPolygon) : map.removeLayer(layerPolygon);

document.getElementById("toggleBoundary").onchange = (e) =>
  e.target.checked ? map.addLayer(layerBoundary) : map.removeLayer(layerBoundary);

document.getElementById("toggleBor").onchange = (e) =>
  e.target.checked ? map.addLayer(layerBor) : map.removeLayer(layerBor);

document.getElementById("toggleGali").onchange = (e) =>
  e.target.checked ? map.addLayer(layerGali) : map.removeLayer(layerGali);

document.getElementById("toggleRiskHigh").onchange = (e) =>
  e.target.checked ? map.addLayer(layerRisikoTinggi) : map.removeLayer(layerRisikoTinggi);

document.getElementById("toggleRiskMedium").onchange = (e) =>
  e.target.checked ? map.addLayer(layerRisikoSedang) : map.removeLayer(layerRisikoSedang);

document.getElementById("toggleRiskLow").onchange = (e) =>
  e.target.checked ? map.addLayer(layerRisikoRendah) : map.removeLayer(layerRisikoRendah);

// ==========================
// NEW: Reset View
// ==========================
document.getElementById("btn-reset-view").onclick = () => {
  if (initialBounds) map.fitBounds(initialBounds, { padding: [24, 24] });
  else map.setView([0.52, 101.45], 8);
};

// ==========================
// NEW: Locate Me
// ==========================
document.getElementById("btn-locate").onclick = () => {
  if (!navigator.geolocation) {
    window.AppUI?.toast?.("Browser tidak mendukung geolocation", false);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (locateLayer) map.removeLayer(locateLayer);
      locateLayer = L.layerGroup().addTo(map);

      L.circle([lat, lng], {
        radius: Math.max(30, pos.coords.accuracy || 50),
        color: "#0ea5e9",
        weight: 2,
        fillOpacity: 0.12,
      }).addTo(locateLayer);

      L.marker([lat, lng]).addTo(locateLayer).bindPopup("Lokasi Anda").openPopup();

      map.flyTo([lat, lng], 15, { duration: 0.8 });
      window.AppUI?.toast?.("Lokasi ditemukan");
    },
    () => window.AppUI?.toast?.("Izin lokasi ditolak / gagal", false),
    { enableHighAccuracy: true, timeout: 8000 }
  );
};

// ==========================
// NEW: Search titik (id_sumur/kecamatan)
// ==========================
const searchInput = document.getElementById("map-search");
const btnClearSearch = document.getElementById("btn-clear-search");

function findBestMatch(q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return null;

  // priority: exact id
  let exact = wells.find(
    (w) => String(w.props.id_sumur || "").trim().toLowerCase() === s
  );
  if (exact) return exact;

  // contains in id or kecamatan
  let contains = wells.find((w) => {
    const id = String(w.props.id_sumur || "").toLowerCase();
    const kec = String(w.props.kecamatan || "").toLowerCase();
    return id.includes(s) || kec.includes(s);
  });
  return contains || null;
}

function zoomToWell(w) {
  if (!w) return;
  map.flyTo(w.latlng, 16, { duration: 0.75 });
  w.marker.openPopup();

  // highlight pulse ring
  const pulse = L.circleMarker(w.latlng, {
    radius: 18,
    color: "#0ea5e9",
    weight: 2,
    fillOpacity: 0.05,
  }).addTo(map);

  setTimeout(() => map.removeLayer(pulse), 900);
}

let searchTimer = null;
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const w = findBestMatch(searchInput.value);
    if (w) {
      zoomToWell(w);
      window.AppUI?.toast?.("Titik ditemukan");
    }
  }, 350);
});

searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const w = findBestMatch(searchInput.value);
    if (!w) return window.AppUI?.toast?.("Tidak ditemukan", false);
    zoomToWell(w);
  }
});

btnClearSearch?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  window.AppUI?.toast?.("Search dibersihkan");
});

// ==========================
// NEW: Export Filtered Data (CSV)
// ==========================
function toCSV(rows) {
  const headers = [
    "id_sumur",
    "kecamatan",
    "jenis_sumur",
    "pH",
    "jarak_septictank_m",
    "jarak_selokan_m",
    "bau",
    "rasa",
    "latitude",
    "longitude",
    "risiko",
  ];

  const escCsv = (v) => {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => escCsv(h === "risiko" ? r.risiko : r[h]))
        .join(",")
    );
  }
  return lines.join("\n");
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

document.getElementById("btn-export-filtered").onclick = () => {
  const visible = wells.filter((w) => w.visible);
  if (!visible.length) {
    window.AppUI?.toast?.("Tidak ada data untuk diexport", false);
    return;
  }

  const rows = visible.map((w) => ({
    ...w.props,
    risiko: w.risiko,
  }));

  const csv = toCSV(rows);
  const fname = `filtered_sumur_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(fname, csv, "text/csv;charset=utf-8");
  window.AppUI?.toast?.("CSV berhasil diunduh");
};
