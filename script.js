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
  const t = (value - min) / (max - min);
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

// ==========================
// LOAD POLYGON RIAU
// ==========================
fetch("data/polygon_riau.json")
  .then((r) => r.json())
  .then((data) => {
    const vals = data.features.map((f) => f.properties?.OBJECTID ?? 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    L.geoJSON(data, {
      pane: "panePolygon",
      style: (f) => ({
        fillColor: interpolateColor(f.properties?.OBJECTID ?? 0, min, max),
        fillOpacity: 0.85,
        color: "transparent",
        weight: 0,
      }),
    }).addTo(layerPolygon);

    L.geoJSON(data, {
      pane: "paneBoundary",
      style: {
        color: "#1e293b",
        weight: 0.6,
        fillOpacity: 0,
      },
    }).addTo(layerBoundary);

    map.fitBounds(layerPolygon.getBounds());
  });

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
// STATE: simpan semua titik untuk difilter
// ==========================
const wells = []; // { marker, circle, isBor, risiko, phNum, septic, selokan }

// ==========================
// STAT COUNTER (total dataset)
// ==========================
let total = 0,
  bor = 0,
  gali = 0;

// ==========================
// LOAD DATA SUMUR
// ==========================
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

        // kalau NaN, anggap jauh biar gak bikin error risiko
        const septicSafe = Number.isFinite(septic) ? septic : 999999;
        const selokanSafe = Number.isFinite(selokan) ? selokan : 999999;

        const risiko = hitungRisiko(septicSafe, selokanSafe);

        // Marker jenis sumur
        const marker = L.marker(latlng, {
          icon: isBor ? iconBor : iconGali,
        });

        // Circle risiko
        const circle = L.circleMarker(latlng, {
          radius: 9,
          color: warnaRisiko(risiko),
          weight: 2,
          fillOpacity: 0.5,
        });

        // Tambah ke layer (awal tampil semua)
        (isBor ? layerBor : layerGali).addLayer(marker);

        if (risiko === "Tinggi") layerRisikoTinggi.addLayer(circle);
        else if (risiko === "Sedang") layerRisikoSedang.addLayer(circle);
        else layerRisikoRendah.addLayer(circle);

        marker.bindPopup(`
          <b>Jenis:</b> ${p.jenis_sumur ?? "-"}<br>
          <b>pH:</b> ${p.pH ?? "-"}<br>
          <b>Jarak Septic:</b> ${Number.isFinite(septic) ? septic : "-"} m<br>
          <b>Jarak Selokan:</b> ${
            Number.isFinite(selokan) ? selokan : "-"
          } m<br>
          <b>Risiko:</b> ${risiko}<br>
          <b>Bau:</b> ${p.bau ?? "-"}<br>
          <b>Rasa:</b> ${p.rasa ?? "-"}
        `);

        wells.push({
          marker,
          circle,
          isBor,
          risiko,
          phNum: parsePHNumeric(p.pH),
          septic: Number.isFinite(septic) ? septic : null,
          selokan: Number.isFinite(selokan) ? selokan : null,
        });

        return marker;
      },
    });

    // Update statistik dasar
    document.getElementById("total-sumur").textContent = total;
    document.getElementById("count-bor").textContent = bor;
    document.getElementById("count-gali").textContent = gali;

    // Apply filter awal (biar "Menampilkan" kebaca)
    applyFilters();
  });

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

    // ---- pH ----
    if (phMin !== null || phMax !== null) {
      if (w.phNum === null) ok = false;
      if (ok && phMin !== null && w.phNum < phMin) ok = false;
      if (ok && phMax !== null && w.phNum > phMax) ok = false;
    }

    // ---- septic ----
    if (ok && (septicMin !== null || septicMax !== null)) {
      if (w.septic === null) ok = false;
      if (ok && septicMin !== null && w.septic < septicMin) ok = false;
      if (ok && septicMax !== null && w.septic > septicMax) ok = false;
    }

    // ---- selokan ----
    if (ok && (selokanMin !== null || selokanMax !== null)) {
      if (w.selokan === null) ok = false;
      if (ok && selokanMin !== null && w.selokan < selokanMin) ok = false;
      if (ok && selokanMax !== null && w.selokan > selokanMax) ok = false;
    }

    // Apply tampil/sembunyi: marker + circle
    if (ok) {
      shown++;

      // pastikan marker masuk group jenis yang benar
      if (w.isBor) {
        if (!layerBor.hasLayer(w.marker)) layerBor.addLayer(w.marker);
        if (layerGali.hasLayer(w.marker)) layerGali.removeLayer(w.marker);
      } else {
        if (!layerGali.hasLayer(w.marker)) layerGali.addLayer(w.marker);
        if (layerBor.hasLayer(w.marker)) layerBor.removeLayer(w.marker);
      }

      // pastikan circle masuk group risiko yang benar
      layerRisikoTinggi.removeLayer(w.circle);
      layerRisikoSedang.removeLayer(w.circle);
      layerRisikoRendah.removeLayer(w.circle);

      if (w.risiko === "Tinggi") layerRisikoTinggi.addLayer(w.circle);
      else if (w.risiko === "Sedang") layerRisikoSedang.addLayer(w.circle);
      else layerRisikoRendah.addLayer(w.circle);
    } else {
      // remove dari semua group
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

// tombol
document.getElementById("btn-apply-filter").onclick = () => applyFilters();

document.getElementById("btn-reset-filter").onclick = () => {
  const ids = [
    "filter-ph-min",
    "filter-ph-max",
    "filter-septic-min",
    "filter-septic-max",
    "filter-selokan-min",
    "filter-selokan-max",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  applyFilters();
};

// Enter = apply
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
  e.target.checked
    ? map.addLayer(layerBoundary)
    : map.removeLayer(layerBoundary);

document.getElementById("toggleBor").onchange = (e) =>
  e.target.checked ? map.addLayer(layerBor) : map.removeLayer(layerBor);

document.getElementById("toggleGali").onchange = (e) =>
  e.target.checked ? map.addLayer(layerGali) : map.removeLayer(layerGali);

document.getElementById("toggleRiskHigh").onchange = (e) =>
  e.target.checked
    ? map.addLayer(layerRisikoTinggi)
    : map.removeLayer(layerRisikoTinggi);

document.getElementById("toggleRiskMedium").onchange = (e) =>
  e.target.checked
    ? map.addLayer(layerRisikoSedang)
    : map.removeLayer(layerRisikoSedang);

document.getElementById("toggleRiskLow").onchange = (e) =>
  e.target.checked
    ? map.addLayer(layerRisikoRendah)
    : map.removeLayer(layerRisikoRendah);
