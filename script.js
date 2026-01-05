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

function klasifikasiPH(ph) {
  if (!ph) return "Netral";

  const v = ph.toString().trim();

  if (v.startsWith("<")) return "Asam";
  if (v.startsWith(">")) return "Basa";
  if (v === "7") return "Netral";

  return "Netral";
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
// STAT COUNTER
// ==========================
let total = 0,
  bor = 0,
  gali = 0,
  tinggi = 0,
  sedang = 0,
  rendah = 0;

let phAsam = 0,
  phNetral = 0,
  phBasa = 0;

let berbau = 0,
  tidakBerbau = 0;

let berasa = 0,
  normalRasa = 0;

// ==========================
// LOAD DATA SUMUR
// ==========================
fetch("data/kualitas_air_sumur.json")
  .then((r) => r.json())
  .then((data) => {
    L.geoJSON(data, {
      pointToLayer: (f, latlng) => {
        const p = f.properties;
        total++;

        // ===== PARAMETER FISIK =====
        const phKategori = klasifikasiPH(p.pH);
        if (phKategori === "Asam") phAsam++;
        else if (phKategori === "Basa") phBasa++;
        else phNetral++;

        const bau = p.bau.toLowerCase();

        if (bau.includes("tidak")) {
          tidakBerbau++;
        } else {
          berbau++;
        }

        const rasa = p.rasa.toLowerCase();

        if (rasa.includes("normal")) {
          normalRasa++;
        } else {
          berasa++;
        }

        // ===== RISIKO =====
        const risiko = hitungRisiko(
          Number(p.jarak_septictank_m),
          Number(p.jarak_selokan_m)
        );

        if (risiko === "Tinggi") tinggi++;
        else if (risiko === "Sedang") sedang++;
        else rendah++;

        // ===== MARKER =====
        const isBor = p.jenis_sumur.toLowerCase().includes("bor");
        const marker = L.marker(latlng, {
          icon: isBor ? iconBor : iconGali,
        });

        if (isBor) {
          bor++;
          marker.addTo(layerBor);
        } else {
          gali++;
          marker.addTo(layerGali);
        }

        const circle = L.circleMarker(latlng, {
          radius: 9,
          color: warnaRisiko(risiko),
          weight: 2,
          fillOpacity: 0.5,
        });

        if (risiko === "Tinggi") circle.addTo(layerRisikoTinggi);
        else if (risiko === "Sedang") circle.addTo(layerRisikoSedang);
        else circle.addTo(layerRisikoRendah);

        marker.bindPopup(`
          <b>ID:</b> ${p.id_sumur}<br>
          <b>Jenis:</b> ${p.jenis_sumur}<br>
          <b>pH:</b> ${p.pH}<br>
          <b>Bau:</b> ${p.bau}<br>
          <b>Rasa:</b> ${p.rasa}<br>
          <b>Risiko:</b> ${risiko}
        `);

        return marker;
      },
    });

    // ===== UPDATE DASHBOARD =====
    document.getElementById("total-sumur").textContent = total;
    document.getElementById("count-bor").textContent = bor;
    document.getElementById("count-gali").textContent = gali;

    document.getElementById("count-tinggi").textContent = tinggi;
    document.getElementById("count-sedang").textContent = sedang;
    document.getElementById("count-rendah").textContent = rendah;

    document.getElementById("ph-asam").textContent = phAsam;
    document.getElementById("ph-netral").textContent = phNetral;
    document.getElementById("ph-basa").textContent = phBasa;

    document.getElementById("air-berbau").textContent = berbau;
    document.getElementById("air-tidak-berbau").textContent = tidakBerbau;

    document.getElementById("air-berasa").textContent = berasa;
    document.getElementById("air-normal").textContent = normalRasa;
  });

// ==========================
// TOGGLES
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
