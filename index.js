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

function hitungRisiko(septic, selokan) {
  const s = Number.isFinite(septic) ? septic : 999999;
  const k = Number.isFinite(selokan) ? selokan : 999999;
  if (s <= 10 || k <= 10) return "Tinggi";
  if (s <= 20 || k <= 20) return "Sedang";
  return "Rendah";
}

(async function () {
  const els = {
    total: document.getElementById("sum-total"),
    bor: document.getElementById("sum-bor"),
    gali: document.getElementById("sum-gali"),
    avgph: document.getElementById("sum-avgph"),
    rHigh: document.getElementById("sum-high"),
    rMed: document.getElementById("sum-med"),
    rLow: document.getElementById("sum-low"),
    total2: document.getElementById("sum-total-2"),
    avgph2: document.getElementById("sum-avgph-2"),
    highPct: document.getElementById("sum-high-pct"),
    safePct: document.getElementById("sum-safe-pct"),
  };

  try {
    const r = await fetch("data/kualitas_air_sumur.json", { cache: "no-store" });
    const geo = await r.json();
    const feats = geo.features || [];

    let total = 0, bor = 0, gali = 0, phSum = 0, phCount = 0, high = 0, med = 0, low = 0;

    for (const f of feats) {
      const p = f.properties || {};
      total++;

      const jenis = String(p.jenis_sumur || "").toLowerCase();
      if (jenis.includes("bor")) bor++;
      else gali++;

      const phNum = parsePHNumeric(p.pH);
      if (phNum !== null) {
        phSum += phNum;
        phCount++;
      }

      const septic = Number(p.jarak_septictank_m);
      const selokan = Number(p.jarak_selokan_m);
      const risiko = hitungRisiko(septic, selokan);
      if (risiko === "Tinggi") high++;
      else if (risiko === "Sedang") med++;
      else low++;
    }

    const avgPh = phCount > 0 ? (phSum / phCount).toFixed(2) : "—";
    const highPct = total > 0 ? ((high / total) * 100).toFixed(1) + "%" : "—";
    const safePct = total > 0 ? (((med + low) / total) * 100).toFixed(1) + "%" : "—";

    if (els.total) els.total.textContent = String(total);
    if (els.bor) els.bor.textContent = String(bor);
    if (els.gali) els.gali.textContent = String(gali);
    if (els.avgph) els.avgph.textContent = avgPh;
    if (els.rHigh) els.rHigh.textContent = String(high);
    if (els.rMed) els.rMed.textContent = String(med);
    if (els.rLow) els.rLow.textContent = String(low);

    // New stats section
    if (els.total2) els.total2.textContent = String(total);
    if (els.avgph2) els.avgph2.textContent = avgPh;
    if (els.highPct) els.highPct.textContent = highPct;
    if (els.safePct) els.safePct.textContent = safePct;

  } catch (e) {
    console.error(e);
    if (els.total) els.total.textContent = "—";
    if (els.avgph) els.avgph.textContent = "—";
  }
})();