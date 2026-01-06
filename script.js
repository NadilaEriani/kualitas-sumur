const map = L.map("map", { maxZoom: 20 }).setView([0.52, 101.45], 11);
// ====== Fokus dari data.html: map.html?lat=...&lng=...&z=...&id=... ======
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getMapTargetFromUrl() {
  const p = new URLSearchParams(location.search);

  const latStr = p.get("lat");
  const lngStr = p.get("lng");
  if (latStr === null || lngStr === null) return null; // <- penting

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const zStr = p.get("z");
  const zRaw = zStr === null ? 17 : parseInt(zStr, 10);
  const z = clamp(Number.isFinite(zRaw) ? zRaw : 17, 1, 20);

  const id = (p.get("id") || "").trim();
  return { lat, lng, z, id };
}

const MAP_TARGET = window.__MAP_TARGET__ ?? getMapTargetFromUrl();

map.createPane("panePolygon");
map.getPane("panePolygon").style.zIndex = 200;

map.createPane("paneBoundary");
map.getPane("paneBoundary").style.zIndex = 300;

map.createPane("panePoint");
map.getPane("panePoint").style.zIndex = 500;
// ====== ZONA RADIUS (di bawah marker tapi di atas boundary) ======
map.createPane("paneZone");
map.getPane("paneZone").style.zIndex = 420; // boundary 300, point 500

const basemaps = {
  osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "© OpenStreetMap",
  }),

  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 20,
      attribution: "© Esri",
    }
  ),

  hybrid: L.layerGroup([
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 20,
      }
    ),
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        opacity: 0.9,
      }
    ),
  ]),

  terrain: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 20,
      attribution: "© Esri",
    }
  ),

  cartoLight: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      attribution: "© CartoDB",
    }
  ),

  cartoDark: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      attribution: "© CartoDB",
    }
  ),
};

let currentBasemap = basemaps.osm;
currentBasemap.addTo(map);

document
  .getElementById("basemap-select")
  .addEventListener("change", function () {
    map.removeLayer(currentBasemap);

    const value = this.value;
    if (value === "satellite") currentBasemap = basemaps.satellite;
    else if (value === "hybrid") currentBasemap = basemaps.hybrid;
    else if (value === "terrain") currentBasemap = basemaps.terrain;
    else if (value === "carto-light") currentBasemap = basemaps.cartoLight;
    else if (value === "carto-dark") currentBasemap = basemaps.cartoDark;
    else currentBasemap = basemaps.osm;

    currentBasemap.addTo(map);
    currentBasemap.bringToBack();

    window.AppUI?.toast?.(
      `Basemap diubah ke ${this.options[this.selectedIndex].text}`
    );
  });

const layerPolygon = L.layerGroup({ pane: "panePolygon" }).addTo(map);
const layerBoundary = L.layerGroup({ pane: "paneBoundary" }).addTo(map);

const layerBor = L.layerGroup({ pane: "panePoint" }).addTo(map);
const layerGali = L.layerGroup({ pane: "panePoint" }).addTo(map);
const zoneLayerSeptic = L.layerGroup({ pane: "paneZone" });
const zoneLayerSelokan = L.layerGroup({ pane: "paneZone" });

const layerRisikoTinggi = L.layerGroup({ pane: "panePoint" }).addTo(map);
const layerRisikoSedang = L.layerGroup({ pane: "panePoint" }).addTo(map);
const layerRisikoRendah = L.layerGroup({ pane: "panePoint" }).addTo(map);

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

const wells = [];
let initialBounds = null;
let locateLayer = null;

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
// ====== ZONA RADIUS UI ======
const ZONE = {
  septicOn: document.getElementById("zone-septic-on"),
  selokanOn: document.getElementById("zone-selokan-on"),
  scale: document.getElementById("zone-scale"),
  max: document.getElementById("zone-max"),
};

function readZoneSettings() {
  const showSeptic = !!ZONE.septicOn?.checked;
  const showSelokan = !!ZONE.selokanOn?.checked;

  const scaleRaw = Number(String(ZONE.scale?.value ?? "1").trim());
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1;

  const maxRaw = ZONE.max ? Number(String(ZONE.max.value ?? "").trim()) : NaN;
  const max = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : null;

  return { showSeptic, showSelokan, scale, max };
}

function calcRadiusMeters(baseMeters, scale, max) {
  if (baseMeters === null || baseMeters === undefined) return null;
  const b = Number(baseMeters);
  if (!Number.isFinite(b) || b <= 0) return null;

  let r = b * scale;
  if (max !== null) r = Math.min(r, max);
  if (!Number.isFinite(r) || r <= 0) return null;
  return r;
}

function isWellActuallyShown(w) {
  // zona cuma ikut filter (visible), TIDAK ikut toggle Bor/Gali
  return !!w?.visible;
}

function isRiskLayerEnabledForWell(w) {
  if (w.risiko === "Tinggi") return map.hasLayer(layerRisikoTinggi);
  if (w.risiko === "Sedang") return map.hasLayer(layerRisikoSedang);
  return map.hasLayer(layerRisikoRendah);
}

function renderZones() {
  if (!wells || wells.length === 0) return;

  const { showSeptic, showSelokan, scale, max } = readZoneSettings();

  // nyalakan / matikan layer zona
  if (showSeptic) {
    if (!map.hasLayer(zoneLayerSeptic)) zoneLayerSeptic.addTo(map);
  } else {
    if (map.hasLayer(zoneLayerSeptic)) map.removeLayer(zoneLayerSeptic);
    zoneLayerSeptic.clearLayers();
  }

  if (showSelokan) {
    if (!map.hasLayer(zoneLayerSelokan)) zoneLayerSelokan.addTo(map);
  } else {
    if (map.hasLayer(zoneLayerSelokan)) map.removeLayer(zoneLayerSelokan);
    zoneLayerSelokan.clearLayers();
  }

  // kalau dua-duanya off, selesai
  if (!showSeptic && !showSelokan) return;

  // rebuild isi layer
  if (showSeptic) zoneLayerSeptic.clearLayers();
  if (showSelokan) zoneLayerSelokan.clearLayers();

  for (const w of wells) {
    if (!isWellActuallyShown(w)) continue; // lolos filter + jenis layer on
    if (!isRiskLayerEnabledForWell(w)) continue; // risiko layer on baru boleh ada zona

    if (showSeptic) {
      const r = calcRadiusMeters(w.septic, scale, max);
      if (r !== null) {
        if (!w.zoneSepticCircle) {
          w.zoneSepticCircle = L.circle(w.latlng, {
            pane: "paneZone",
            radius: r,
            color: "#f97316",
            weight: 1.5,
            opacity: 0.70,
            fillOpacity: 0.06,
            dashArray: "6 6",
            interactive: false,
          });
        } else {
          w.zoneSepticCircle.setLatLng(w.latlng);
          w.zoneSepticCircle.setRadius(r);
        }
        zoneLayerSeptic.addLayer(w.zoneSepticCircle);
      }
    }

    if (showSelokan) {
      const r = calcRadiusMeters(w.selokan, scale, max);
      if (r !== null) {
        if (!w.zoneSelokanCircle) {
          w.zoneSelokanCircle = L.circle(w.latlng, {
            pane: "paneZone",
            radius: r,
            color: "#0ea5e9",
            weight: 1.5,
            opacity: 0.70,
            fillOpacity: 0.06,
            dashArray: "2 6",
            interactive: false,
          });
        } else {
          w.zoneSelokanCircle.setLatLng(w.latlng);
          w.zoneSelokanCircle.setRadius(r);
        }
        zoneLayerSelokan.addLayer(w.zoneSelokanCircle);
      }
    }
  }
}

// listener supaya zona langsung update saat diubah
(function bindZoneUI() {
  const rerender = () => renderZones();

  ZONE.septicOn?.addEventListener("change", rerender);
  ZONE.selokanOn?.addEventListener("change", rerender);
  ZONE.scale?.addEventListener("change", rerender);

  let t = null;
  ZONE.max?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(rerender, 180);
  });
})();

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
        fillOpacity: 0.35,
        color: "transparent",
        weight: 0,
      }),
    }).addTo(layerPolygon);

    L.geoJSON(data, {
      pane: "paneBoundary",
      style: {
        color: "#1e293b",
        weight: 1,
        fillOpacity: 0,
        dashArray: "5, 5",
      },
    }).addTo(layerBoundary);

    initialBounds = poly.getBounds();

    // kalau tidak ada target dari data.html -> baru fitBounds
    if (!MAP_TARGET) {
      map.fitBounds(initialBounds, { padding: [24, 24] });
    }
  });

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
              <span class="badge-risk ${badgeClass(risiko)}">${esc(
          risiko
        )}</span>
            </div>

            <div class="popup-grid">
              <div><b>Jenis:</b> ${esc(p.jenis_sumur ?? "-")}</div>
              <div><b>pH:</b> ${esc(p.pH ?? "-")}</div>
              <div><b>Septic:</b> ${
                Number.isFinite(septic) ? esc(septic) : "-"
              } m</div>
              <div><b>Selokan:</b> ${
                Number.isFinite(selokan) ? esc(selokan) : "-"
              } m</div>
              <div><b>Bau:</b> ${esc(p.bau ?? "-")}</div>
              <div><b>Rasa:</b> ${esc(p.rasa ?? "-")}</div>
              <div><b>Koordinat:</b> <span class="mono">${lat.toFixed(
                6
              )}, ${lng.toFixed(6)}</span></div>
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
    applyFilters();
    focusFromUrlTarget();
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

    if (phMin !== null || phMax !== null) {
      if (w.phNum === null) ok = false;
      if (ok && phMin !== null && w.phNum < phMin) ok = false;
      if (ok && phMax !== null && w.phNum > phMax) ok = false;
    }

    if (ok && (septicMin !== null || septicMax !== null)) {
      if (w.septic === null) ok = false;
      if (ok && septicMin !== null && w.septic < septicMin) ok = false;
      if (ok && septicMax !== null && w.septic > septicMax) ok = false;
    }

    if (ok && (selokanMin !== null || selokanMax !== null)) {
      if (w.selokan === null) ok = false;
      if (ok && selokanMin !== null && w.selokan < selokanMin) ok = false;
      if (ok && selokanMax !== null && w.selokan > selokanMax) ok = false;
    }

    w.visible = ok;

    if (ok) {
      shown++;

      if (w.isBor) {
        if (!layerBor.hasLayer(w.marker)) layerBor.addLayer(w.marker);
        if (layerGali.hasLayer(w.marker)) layerGali.removeLayer(w.marker);
      } else {
        if (!layerGali.hasLayer(w.marker)) layerGali.addLayer(w.marker);
        if (layerBor.hasLayer(w.marker)) layerBor.removeLayer(w.marker);
      }

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
  renderZones();
}

document.getElementById("btn-apply-filter").addEventListener("click", () => {
  applyFilters();
  window.AppUI?.toast?.("Filter diterapkan");
});

document.getElementById("btn-reset-filter").addEventListener("click", () => {
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
  window.AppUI?.toast?.("Filter direset");
});

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
    if (e.key === "Enter") {
      applyFilters();
      window.AppUI?.toast?.("Filter diterapkan");
    }
  });
});

document.getElementById("togglePolygon").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerPolygon);
  else map.removeLayer(layerPolygon);
});

document.getElementById("toggleBoundary").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerBoundary);
  else map.removeLayer(layerBoundary);
});

document.getElementById("toggleBor").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerBor);
  else map.removeLayer(layerBor);
});

document.getElementById("toggleGali").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerGali);
  else map.removeLayer(layerGali);
});

document.getElementById("toggleRiskHigh").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerRisikoTinggi);
  else map.removeLayer(layerRisikoTinggi);
});

document.getElementById("toggleRiskMedium").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerRisikoSedang);
  else map.removeLayer(layerRisikoSedang);
});

document.getElementById("toggleRiskLow").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerRisikoRendah);
  else map.removeLayer(layerRisikoRendah);
});

document.getElementById("btn-reset-view").addEventListener("click", () => {
  if (initialBounds) map.fitBounds(initialBounds, { padding: [24, 24] });
  else map.setView([0.52, 101.45], 11);
  window.AppUI?.toast?.("View direset");
});

document.getElementById("btn-locate").addEventListener("click", () => {
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

      L.marker([lat, lng])
        .addTo(locateLayer)
        .bindPopup("Lokasi Anda")
        .openPopup();

      map.flyTo([lat, lng], 15, { duration: 0.8 });
      window.AppUI?.toast?.("Lokasi ditemukan");
    },
    () => window.AppUI?.toast?.("Izin lokasi ditolak / gagal", false),
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

const searchInput = document.getElementById("map-search");
const btnClearSearch = document.getElementById("btn-clear-search");

function findBestMatch(q) {
  const s = String(q || "")
    .trim()
    .toLowerCase();
  if (!s) return null;

  let exact = wells.find(
    (w) =>
      String(w.props.id_sumur || "")
        .trim()
        .toLowerCase() === s
  );
  if (exact) return exact;

  let contains = wells.find((w) => {
    const id = String(w.props.id_sumur || "").toLowerCase();
    const kec = String(w.props.kecamatan || "").toLowerCase();
    return id.includes(s) || kec.includes(s);
  });
  return contains || null;
}

function zoomToWell(w) {
  if (!w) return;
  map.flyTo(w.latlng, 18, { duration: 0.8 });
  w.marker.openPopup();

  const pulse = L.circleMarker(w.latlng, {
    radius: 18,
    color: "#0ea5e9",
    weight: 2,
    fillOpacity: 0.05,
  }).addTo(map);

  setTimeout(() => map.removeLayer(pulse), 900);
}

function findNearestWell(lat, lng) {
  let best = null;
  let bestDist = Infinity;

  for (const w of wells) {
    const d = map.distance([lat, lng], w.latlng);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }

  // toleransi 200 meter biar aman
  if (best && bestDist <= 200) return best;
  return null;
}

function focusFromUrlTarget() {
  if (!MAP_TARGET) return;

  // kalau wells belum siap, tunggu
  if (!wells || wells.length === 0) return;

  const { lat, lng, z, id } = MAP_TARGET;

  // 1) kalau ada id dan kebetulan sama dengan id_sumur di dataset, buka marker itu
  // NOTE: di data.js kamu mungkin ngirim UUID (row.id) → ini TIDAK sama dengan id_sumur "AS001", dll.
  let w = null;
  if (id) {
    w =
      wells.find((x) => String(x.props?.id_sumur || "").trim() === id) || null;
  }

  // 2) fallback: cari marker terdekat dari koordinat
  if (!w) w = findNearestWell(lat, lng);

  if (w) {
    map.flyTo(w.latlng, z || 20, { duration: 0.8 });
    w.marker.openPopup();
    return;
  }

  // 3) kalau tidak ketemu marker (misal data map dari file json beda dengan supabase),
  // tetap fokus ke koordinat + marker sementara
  map.flyTo([lat, lng], z || 20, { duration: 0.8 });

  const temp = L.marker([lat, lng]).addTo(map);
  temp
    .bindPopup(
      `Lokasi dari Database<br><span class="mono">${lat.toFixed(
        6
      )}, ${lng.toFixed(6)}</span>`
    )
    .openPopup();

  setTimeout(() => {
    try {
      map.removeLayer(temp);
    } catch {}
  }, 6000);
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
  }, 500);
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
      headers.map((h) => escCsv(h === "risiko" ? r.risiko : r[h])).join(",")
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

document.getElementById("btn-export-filtered").addEventListener("click", () => {
  const visible = wells.filter((w) => w.visible);
  if (!visible.length) {
    window.AppUI?.toast?.("Tidak ada data untuk diexport", false);
    return;
  }

  const rows = visible.map((w) => ({ ...w.props, risiko: w.risiko }));
  const csv = toCSV(rows);
  const now = new Date();
  const fname = `filtered_sumur_${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
    now.getHours()
  ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}.csv`;
  downloadFile(fname, csv, "text/csv;charset=utf-8");
  window.AppUI?.toast?.("CSV berhasil diunduh");
});

map.addControl(
  new L.Control.Scale({ position: "bottomleft", metric: true, imperial: false })
);
let _zoneTick = null;
function requestZonesRefresh() {
  clearTimeout(_zoneTick);
  _zoneTick = setTimeout(() => renderZones(), 0);
}

document.getElementById("toggleRiskHigh").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerRisikoTinggi);
  else map.removeLayer(layerRisikoTinggi);
  requestZonesRefresh();
});

document.getElementById("toggleRiskMedium").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerRisikoSedang);
  else map.removeLayer(layerRisikoSedang);
  requestZonesRefresh();
});

document.getElementById("toggleRiskLow").addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(layerRisikoRendah);
  else map.removeLayer(layerRisikoRendah);
  requestZonesRefresh();
});
