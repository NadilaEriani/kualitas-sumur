(() => {
  "use strict";

  const SUPABASE_URL = "https://sanvsobyezkgyljknxvy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbnZzb2J5ZXprZ3lsamtueHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODY1MjEsImV4cCI6MjA4MTA2MjUyMX0._xjZQ9A5kFf3UEmlBzjD33VwSQQ1un5bxJl7HFIPr7c";

  const TABLE_DEFAULT = "sumur";
  const DB_PK = "id";
  const COLSPAN = 11; // user view (tanpa kolom aksi)

  const el = (id) => document.getElementById(id);

  const badge = el("db-badge");
  const hint = el("db-hint");
  const countEl = el("db-count");

  const tableInput = el("db-table");
  const searchInput = el("db-search");
  const jenisSelect = el("db-jenis");
  const phSelect = el("db-ph");
  const pageSizeSelect = el("db-pagesize");

  const tbody = el("db-body");
  const pageEl = el("db-page");
  const totalEl = el("db-total");

  const btnPrev = el("btn-prev");
  const btnNext = el("btn-next");
  const btnRefresh = el("btn-refresh");
  const btnExport = el("btn-export");

  const toastBox = el("db-toast");

  const sb =
    window.supabase && typeof window.supabase.createClient === "function"
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

  let currentPage = 1;
  let totalRows = 0;
  let searchTimer = null;

  let sortKey = "created_at";
  let sortAsc = false;
  let pageSize = 10;

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ rename supaya tidak bentrok dengan ui.js
  function showToast(msg, ok = true) {
    if (!toastBox) return;
    toastBox.textContent = msg;
    toastBox.classList.toggle("ok", ok);
    toastBox.classList.toggle("bad", !ok);
    toastBox.classList.add("show");
    setTimeout(() => toastBox.classList.remove("show"), 2200);
  }

  function getTable() {
    const t = (tableInput?.value || "").trim();
    return t || TABLE_DEFAULT;
  }

  function setConnected(ok, msg = "") {
    if (!badge) return;
    badge.textContent = ok ? "Terhubung" : "Gagal";
    badge.classList.toggle("ok", ok);
    badge.classList.toggle("bad", !ok);
    if (hint) hint.textContent = msg || "";
  }

  function emptyState(msg, icon = "fa-circle-info") {
    tbody.innerHTML = `
      <tr>
        <td colspan="${COLSPAN}" class="db-empty">
          <div class="empty-box">
            <i class="fa-solid ${icon}"></i>
            <div>${esc(msg)}</div>
          </div>
        </td>
      </tr>
    `;
  }

  function syncPageSizeFromUI() {
    const v = Number(pageSizeSelect?.value);
    pageSize = [10, 50, 100].includes(v) ? v : 10;
  }

  function getPhFilter() {
    const v = (phSelect?.value || "").trim();
    return ["lt7", "eq7", "gt7"].includes(v) ? v : "";
  }

  function phBucket(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(",", ".");
    if (!s) return null;

    if (s.startsWith("<")) return "lt7";
    if (s.startsWith(">")) return "gt7";
    if (s.startsWith("=")) {
      const n2 = Number(s.slice(1).trim());
      if (Number.isFinite(n2)) {
        if (n2 < 7) return "lt7";
        if (n2 > 7) return "gt7";
        return "eq7";
      }
      return s.slice(1).trim() === "7" ? "eq7" : null;
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    if (n < 7) return "lt7";
    if (n > 7) return "gt7";
    return "eq7";
  }

  function isUuid(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(s || "").trim()
    );
  }

  function buildQuery(withCount = true) {
    const t = getTable();
    const cols =
      "id,kecamatan,jenis_sumur,warna,ph,jarak_septictank_m,jarak_selokan_m,bau,rasa,kondisi_sumur,lat,lng,created_at";

    let q = withCount
      ? sb.from(t).select(cols, { count: "exact" })
      : sb.from(t).select(cols);

    const s = (searchInput?.value || "").trim();
    const jenis = (jenisSelect?.value || "").trim();

    if (s) {
      if (isUuid(s)) q = q.eq(DB_PK, s);
      else {
        const like = `%${s}%`;
        q = q.or(
          [
            `kecamatan.ilike.${like}`,
            `jenis_sumur.ilike.${like}`,
            `warna.ilike.${like}`,
            `ph.ilike.${like}`,
            `bau.ilike.${like}`,
            `rasa.ilike.${like}`,
            `kondisi_sumur.ilike.${like}`,
          ].join(",")
        );
      }
    }

    if (jenis) q = q.eq("jenis_sumur", jenis);
    return q;
  }

  async function testConnection() {
    if (!sb) {
      setConnected(false, "Supabase SDK tidak termuat.");
      return;
    }

    try {
      const t = getTable();
      const { error } = await sb.from(t).select(DB_PK, { head: true }).limit(1);
      if (error) throw error;
      setConnected(true, `Table: ${t}`);
    } catch (e) {
      setConnected(false, e?.message || "cek RLS / config");
    }
  }

  async function fetchAllForFilters() {
    const rows = [];
    const CHUNK = 2000;
    let from = 0;

    while (true) {
      const to = from + CHUNK - 1;
      const { data, error } = await buildQuery(false)
        .order(sortKey, { ascending: sortAsc })
        .range(from, to);

      if (error) throw error;
      if (!data || data.length === 0) break;

      rows.push(...data);
      if (data.length < CHUNK) break;

      from += CHUNK;
      if (from > 20000) break; // safety cap
    }
    return rows;
  }

  // ✅ fitur lokasi: tombol menuju map.html seperti fitur lama
  function renderRows(data, startNo) {
    tbody.innerHTML = "";

    data.forEach((row, idx) => {
      const tr = document.createElement("tr");
      const no = startNo + idx;

      const lat = row.lat;
      const lng = row.lng;

      const hasCoord =
        Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

      tr.innerHTML = `
        <td class="db-mono"><b>${no}</b></td>
        <td title="${esc(row.kecamatan)}">${esc(row.kecamatan)}</td>
        <td title="${esc(row.jenis_sumur)}">${esc(row.jenis_sumur)}</td>
        <td title="${esc(row.warna)}">${esc(row.warna)}</td>
        <td class="db-mono" title="${esc(row.ph)}">${esc(row.ph)}</td>
        <td class="db-mono">${esc(row.jarak_septictank_m)}</td>
        <td class="db-mono">${esc(row.jarak_selokan_m)}</td>
        <td title="${esc(row.bau)}">${esc(row.bau)}</td>
        <td title="${esc(row.rasa)}">${esc(row.rasa)}</td>
        <td title="${esc(row.kondisi_sumur)}">${esc(row.kondisi_sumur)}</td>
        <td>
          ${
            hasCoord
              ? `<button class="db-mini"
                  data-act="loc"
                  data-id="${esc(row.id)}"
                  data-lat="${esc(lat)}"
                  data-lng="${esc(lng)}"
                  aria-label="Buka lokasi"
                  title="${esc(lat)}, ${esc(lng)}">
                  <i class="fa-solid fa-location-dot"></i>
                </button>`
              : `<span class="db-mono">-</span>`
          }
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  async function loadPage(page) {
    syncPageSizeFromUI();

    currentPage = Math.max(1, page);
    pageEl.textContent = String(currentPage);

    const phFilter = getPhFilter();
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      if (!sb) {
        emptyState("Supabase SDK belum siap.", "fa-triangle-exclamation");
        return;
      }

      // MODE A: tanpa pH filter -> server paging cepat
      if (!phFilter) {
        const { data, error, count } = await buildQuery(true)
          .order(sortKey, { ascending: sortAsc })
          .range(from, to);

        if (error) {
          emptyState(`Error: ${error.message}`, "fa-triangle-exclamation");
          totalRows = 0;
          totalEl.textContent = "0";
          countEl.value = "0";
          return;
        }

        totalRows = count ?? 0;
        totalEl.textContent = String(totalRows);
        countEl.value = String(totalRows);

        if (!data || data.length === 0) {
          emptyState(
            "Tidak ada data (coba ubah filter/search).",
            "fa-database"
          );
          btnPrev.disabled = currentPage <= 1;
          btnNext.disabled = true;
          return;
        }

        renderRows(data, from + 1);
        btnPrev.disabled = currentPage <= 1;
        btnNext.disabled = currentPage * pageSize >= totalRows;
        return;
      }

      // MODE B: pH filter aktif -> ambil semua lalu filter & paginate di client
      const all = await fetchAllForFilters();
      const filtered = all.filter((r) => phBucket(r.ph) === phFilter);

      totalRows = filtered.length;
      totalEl.textContent = String(totalRows);
      countEl.value = String(totalRows);

      const pageRows = filtered.slice(from, from + pageSize);

      if (!pageRows.length) {
        emptyState("Tidak ada data (coba ubah filter/search).", "fa-database");
        btnPrev.disabled = currentPage <= 1;
        btnNext.disabled = true;
        return;
      }

      renderRows(pageRows, from + 1);
      btnPrev.disabled = currentPage <= 1;
      btnNext.disabled = from + pageSize >= totalRows;
    } catch (e) {
      console.error(e);
      emptyState(
        `Error: ${e?.message || "Failed to fetch"}`,
        "fa-triangle-exclamation"
      );
      showToast("Gagal memuat data.", false);
    }
  }

  function setSort(newKey) {
    const allowed = new Set([
      "kecamatan",
      "jenis_sumur",
      "warna",
      "ph",
      "bau",
      "rasa",
      "kondisi_sumur",
      "jarak_septictank_m",
      "jarak_selokan_m",
      "created_at",
      "lat",
      "lng",
    ]);
    if (!allowed.has(newKey)) return;

    if (sortKey === newKey) sortAsc = !sortAsc;
    else {
      sortKey = newKey;
      sortAsc = true;
    }

    loadPage(1);
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  async function exportCSV() {
    showToast("Menyiapkan export…");
    try {
      const phFilter = getPhFilter();
      const all = await fetchAllForFilters();
      const rows = phFilter
        ? all.filter((r) => phBucket(r.ph) === phFilter)
        : all;

      if (!rows.length) {
        showToast("Tidak ada data untuk diexport", false);
        return;
      }

      const headers = [
        "kecamatan",
        "jenis_sumur",
        "warna",
        "ph",
        "jarak_septictank_m",
        "jarak_selokan_m",
        "bau",
        "rasa",
        "kondisi_sumur",
        "lat",
        "lng",
        "created_at",
      ];

      const lines = [headers.join(",")];
      for (const r of rows)
        lines.push(headers.map((h) => csvEscape(r[h])).join(","));

      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data_sumur_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      showToast("Export CSV berhasil");
    } catch (e) {
      console.error(e);
      showToast(`Export gagal: ${e?.message || "error"}`, false);
    }
  }

  function bind() {
    // refresh
    if (btnRefresh) btnRefresh.onclick = () => loadPage(1);

    // export
    if (btnExport) btnExport.onclick = exportCSV;

    // paging
    if (btnPrev) btnPrev.onclick = () => loadPage(currentPage - 1);
    if (btnNext) btnNext.onclick = () => loadPage(currentPage + 1);

    // filter
    if (jenisSelect) jenisSelect.onchange = () => loadPage(1);
    if (phSelect) phSelect.onchange = () => loadPage(1);
    if (pageSizeSelect) pageSizeSelect.onchange = () => loadPage(1);

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadPage(1), 350);
      });
    }

    // sort header
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.getAttribute("data-sort");
        if (!k) return;
        setSort(k);
      });
    });

    // ✅ klik lokasi -> map.html (fitur lama)
    if (tbody) {
      tbody.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-act='loc']");
        if (!btn) return;

        const lat = btn.getAttribute("data-lat");
        const lng = btn.getAttribute("data-lng");
        const id = btn.getAttribute("data-id") || "";

        if (!lat || !lng) return;

        const url =
          `map.html?lat=${encodeURIComponent(lat)}` +
          `&lng=${encodeURIComponent(lng)}` +
          (id ? `&id=${encodeURIComponent(id)}` : "") +
          `&z=17`;

        window.location.href = url;
      });
    }
  }

  (async function start() {
    bind();
    await testConnection();
    await loadPage(1);
  })();
})();
