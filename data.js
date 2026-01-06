(() => {
  "use strict";

  const SUPABASE_URL = "https://sanvsobyezkgyljknxvy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbnZzb2J5ZXprZ3lsamtueHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODY1MjEsImV4cCI6MjA4MTA2MjUyMX0._xjZQ9A5kFf3UEmlBzjD33VwSQQ1un5bxJl7HFIPr7c";

  const TABLE_DEFAULT = "sumur";
  const DB_PK = "id";
  const COLSPAN = 12;

  const sb =
    window.supabase && typeof window.supabase.createClient === "function"
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

  const el = (id) => document.getElementById(id);
  const btnGeo = el("btn-geo");

  const badge = el("db-badge");
  const hint = el("db-hint");

  const tableInput = el("db-table");
  const searchInput = el("db-search");
  const jenisSelect = el("db-jenis");
  const pageSizeSelect = el("db-pagesize");

  const tbody = el("db-body");
  const pageEl = el("db-page");
  const totalEl = el("db-total");

  const btnPrev = el("btn-prev");
  const btnNext = el("btn-next");
  const btnRefresh = el("btn-refresh");
  const btnAdd = el("btn-add");
  const btnExport = el("btn-export");

  const modal = el("db-modal");
  const modalTitle = el("modal-title");
  const modalClose = el("modal-close");
  const form = el("db-form");
  const errBox = el("db-error");

  const btnCancel = el("btn-cancel");
  const btnSave = el("btn-save");
  const toast = el("db-toast");

  const F = {
    kecamatan: el("f-kecamatan"),
    warna: el("f-warna"),
    kondisi_sumur: el("f-kondisi_sumur"),

    lat: el("f-lat"),
    lng: el("f-lng"),
    jenis_sumur: el("f-jenis_sumur"),
    ph: el("f-ph"),
    jarak_septictank_m: el("f-jarak_septictank_m"),
    jarak_selokan_m: el("f-jarak_selokan_m"),
    bau: el("f-bau"),
    rasa: el("f-rasa"),
  };

  const E = {
    lat: el("e-lat"),
    lng: el("e-lng"),
    ph: el("e-ph"),
    jarak_septictank_m: el("e-jarak_septictank_m"),
    jarak_selokan_m: el("e-jarak_selokan_m"),
  };

  let currentPage = 1;
  let totalRows = 0;
  let editingDbId = null;
  let searchTimer = null;

  let sortKey = "created_at";
  let sortAsc = false;

  let pageSize = 10;
  let lastFocus = null;

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(msg, ok = true) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.toggle("ok", ok);
    toast.classList.toggle("bad", !ok);
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }
  function fillCoordsFromCurrentLocation() {
    if (!navigator.geolocation) {
      showToast("Browser tidak mendukung lokasi (geolocation).", false);
      return;
    }

    showToast("Mengambil lokasi…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // isi ke form
        F.lat.value = Number(lat).toFixed(7);
        F.lng.value = Number(lng).toFixed(7);

        validateAll();
        showToast("Koordinat berhasil diisi dari lokasi saat ini");
      },
      (err) => {
        const msg =
          err?.code === 1
            ? "Izin lokasi ditolak."
            : err?.code === 2
            ? "Lokasi tidak tersedia."
            : "Gagal mengambil lokasi.";
        showToast(msg, false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }

  function getTable() {
    const t = (tableInput?.value || "").trim();
    return t || TABLE_DEFAULT;
  }

  function isUuid(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(s || "").trim()
    );
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

  function renderSkeletonRows(n = 7) {
    let html = "";
    for (let i = 0; i < n; i++) {
      html += `<tr>
        ${Array.from({ length: COLSPAN })
          .map(
            () =>
              `<td><div class="skeleton" style="height:14px;border-radius:10px;"></div></td>`
          )
          .join("")}
      </tr>`;
    }
    tbody.innerHTML = html;
  }

  async function testConnection() {
    if (!sb) {
      badge.textContent = "Gagal";
      badge.classList.add("bad");
      badge.classList.remove("ok");
      hint.textContent =
        "Supabase SDK tidak termuat. Pastikan supabase.min.js (UMD) termuat.";
      return;
    }

    try {
      const t = getTable();
      const { error } = await sb.from(t).select(DB_PK, { head: true }).limit(1);
      if (error) throw error;

      badge.textContent = "Terhubung";
      badge.classList.add("ok");
      badge.classList.remove("bad");
      hint.textContent = `Table: ${t}`;
    } catch (e) {
      badge.textContent = "Gagal";
      badge.classList.add("bad");
      badge.classList.remove("ok");
      hint.textContent = e?.message ? `(${e.message})` : "(cek config / RLS)";
    }
  }

  function buildQuery() {
    const t = getTable();
    const cols =
      "id,kecamatan,jenis_sumur,warna,ph,jarak_septictank_m,jarak_selokan_m,bau,rasa,kondisi_sumur,lat,lng,created_at";

    let q = sb.from(t).select(cols, { count: "exact" });

    const s = (searchInput?.value || "").trim();
    const jenis = (jenisSelect?.value || "").trim();

    if (s) {
      if (isUuid(s)) {
        q = q.eq("id", s);
      } else {
        const like = `%${s}%`;
        q = q.or(
          [
            `id_sumur.ilike.${like}`,
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

  async function loadPage(page) {
    syncPageSizeFromUI();

    currentPage = Math.max(1, page);
    pageEl.textContent = String(currentPage);

    renderSkeletonRows(7);

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      const { data, error, count } = await buildQuery()
        .order(sortKey, { ascending: sortAsc })
        .range(from, to);

      if (error) {
        emptyState(`Error: ${error.message}`, "fa-triangle-exclamation");
        totalRows = 0;
        totalEl.textContent = "0";
        return;
      }

      totalRows = count ?? 0;
      totalEl.textContent = String(totalRows);

      if (!data || data.length === 0) {
        emptyState("Tidak ada data (coba ubah filter/search).", "fa-database");
        btnPrev.disabled = currentPage <= 1;
        btnNext.disabled = true;
        return;
      }

      tbody.innerHTML = "";

      data.forEach((row, idx) => {
        const tr = document.createElement("tr");
        const no = from + idx + 1;

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
          <td class="db-actions-col">
            <button class="db-mini" data-act="edit" data-id="${esc(
              row.id
            )}" aria-label="Edit">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="db-mini danger" data-act="del" data-id="${esc(
              row.id
            )}" aria-label="Hapus">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        `;

        tbody.appendChild(tr);
      });

      btnPrev.disabled = currentPage <= 1;
      btnNext.disabled = currentPage * pageSize >= totalRows;
    } catch (e) {
      emptyState(
        `Error: ${e?.message || "Failed to fetch"}`,
        "fa-triangle-exclamation"
      );
    }
  }

  function openModal(mode, row = null) {
    errBox.textContent = "";
    Object.values(E).forEach((x) => x && (x.textContent = ""));
    lastFocus = document.activeElement;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    const setVal = (input, val) => {
      if (!input) return;
      input.value = val ?? "";
    };

    if (mode === "add") {
      modalTitle.textContent = "Tambah Data";
      editingDbId = null;

      setVal(F.kecamatan, "");
      setVal(F.warna, "");
      setVal(F.kondisi_sumur, "");

      setVal(F.lat, "");
      setVal(F.lng, "");
      setVal(F.jenis_sumur, "Sumur Bor");
      setVal(F.ph, "");
      setVal(F.jarak_septictank_m, "");
      setVal(F.jarak_selokan_m, "");
      setVal(F.bau, "");
      setVal(F.rasa, "");
    } else {
      modalTitle.textContent = "Edit Data";
      editingDbId = row?.id ?? null;

      setVal(F.kecamatan, row?.kecamatan ?? "");
      setVal(F.warna, row?.warna ?? "");
      setVal(F.kondisi_sumur, row?.kondisi_sumur ?? "");

      setVal(F.lat, row?.lat ?? "");
      setVal(F.lng, row?.lng ?? "");
      setVal(F.jenis_sumur, row?.jenis_sumur ?? "Sumur Bor");
      setVal(F.ph, row?.ph ?? "");
      setVal(F.jarak_septictank_m, row?.jarak_septictank_m ?? "");
      setVal(F.jarak_selokan_m, row?.jarak_selokan_m ?? "");
      setVal(F.bau, row?.bau ?? "");
      setVal(F.rasa, row?.rasa ?? "");
    }

    setTimeout(() => F.jenis_sumur?.focus?.(), 0);
    validateAll();
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    lastFocus && lastFocus.focus && lastFocus.focus();
  }

  function setFieldError(key, msg) {
    const box = E[key];
    if (box) box.textContent = msg || "";
  }

  function isValidPH(text) {
    const s = String(text ?? "")
      .trim()
      .replace(",", ".");
    if (!s) return true;
    if (/^[<>]\s*\d+(\.\d+)?$/.test(s)) return true;
    if (/^\d+(\.\d+)?$/.test(s)) return true;
    return false;
  }

  function validateAll() {
    let ok = true;

    const latRaw = F.lat.value;
    const lngRaw = F.lng.value;

    if (latRaw !== "") {
      const lat = Number(latRaw);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        setFieldError("lat", "Latitude harus di rentang -90 s/d 90.");
        ok = false;
      } else setFieldError("lat", "");
    } else setFieldError("lat", "");

    if (lngRaw !== "") {
      const lng = Number(lngRaw);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        setFieldError("lng", "Longitude harus di rentang -180 s/d 180.");
        ok = false;
      } else setFieldError("lng", "");
    } else setFieldError("lng", "");

    if (!isValidPH(F.ph.value)) {
      setFieldError("ph", "Format pH tidak valid. Contoh: 6.9 / 7 / <7 / >7");
      ok = false;
    } else setFieldError("ph", "");

    const spt = F.jarak_septictank_m.value;
    if (spt !== "") {
      const n = Number(spt);
      if (!Number.isFinite(n) || n < 0) {
        setFieldError("jarak_septictank_m", "Jarak septic harus angka >= 0.");
        ok = false;
      } else setFieldError("jarak_septictank_m", "");
    } else setFieldError("jarak_septictank_m", "");

    const slk = F.jarak_selokan_m.value;
    if (slk !== "") {
      const n = Number(slk);
      if (!Number.isFinite(n) || n < 0) {
        setFieldError("jarak_selokan_m", "Jarak selokan harus angka >= 0.");
        ok = false;
      } else setFieldError("jarak_selokan_m", "");
    } else setFieldError("jarak_selokan_m", "");

    const js = (F.jenis_sumur.value || "").trim();
    if (!js) ok = false;

    if (btnSave) btnSave.disabled = !ok;
    return ok;
  }

  function getPayload() {
    const lat = F.lat.value === "" ? null : Number(F.lat.value);
    const lng = F.lng.value === "" ? null : Number(F.lng.value);

    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90))
      return { error: "Latitude tidak valid." };
    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
      return { error: "Longitude tidak valid." };

    if (!isValidPH(F.ph.value)) return { error: "Format pH tidak valid." };

    const septic =
      F.jarak_septictank_m.value === ""
        ? null
        : Number(F.jarak_septictank_m.value);
    const selokan =
      F.jarak_selokan_m.value === "" ? null : Number(F.jarak_selokan_m.value);

    if (septic !== null && (!Number.isFinite(septic) || septic < 0))
      return { error: "Jarak Septictank tidak valid." };
    if (selokan !== null && (!Number.isFinite(selokan) || selokan < 0))
      return { error: "Jarak Selokan tidak valid." };

    const payload = {
      kecamatan: (F.kecamatan.value || "").trim() || null,
      warna: (F.warna.value || "").trim() || null,
      kondisi_sumur: (F.kondisi_sumur.value || "").trim() || null,

      jenis_sumur: (F.jenis_sumur.value || "").trim() || null,
      ph: (F.ph.value || "").trim() || null,
      jarak_septictank_m: septic,
      jarak_selokan_m: selokan,
      lat: lat,
      lng: lng,
      bau: (F.bau.value || "").trim() || null,
      rasa: (F.rasa.value || "").trim() || null,
    };

    return { payload };
  }

  async function save(e) {
    e.preventDefault();
    errBox.textContent = "";

    if (!validateAll()) {
      errBox.textContent = "Periksa kembali input yang belum valid.";
      return;
    }

    const t = getTable();
    const { payload, error } = getPayload();
    if (error) {
      errBox.textContent = error;
      return;
    }

    if (!sb) {
      errBox.textContent = "Supabase tidak siap (SDK belum termuat).";
      return;
    }

    const oldText = btnSave?.textContent;
    if (btnSave) btnSave.disabled = true;

    try {
      if (!editingDbId) {
        const { error: e2 } = await sb.from(t).insert([payload]);
        if (e2) throw e2;

        showToast("Berhasil ditambahkan");
        closeModal();
        await loadPage(1);
        return;
      }

      const { error: e3 } = await sb
        .from(t)
        .update(payload)
        .eq(DB_PK, editingDbId);
      if (e3) throw e3;

      showToast("Berhasil diperbarui");
      closeModal();
      await loadPage(currentPage);
    } catch (ex) {
      errBox.textContent = ex?.message || "Gagal menyimpan.";
    } finally {
      if (btnSave) btnSave.disabled = false;
      if (btnSave && oldText) btnSave.textContent = oldText;
    }
  }

  async function delRow(dbId) {
    const ok = confirm(`Hapus data ini?`);
    if (!ok) return;

    const t = getTable();
    const { error } = await sb.from(t).delete().eq(DB_PK, dbId);
    if (error) {
      showToast(`Gagal hapus: ${error.message}`, false);
      return;
    }
    showToast("Berhasil dihapus");
    await loadPage(currentPage);
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
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

  async function exportCSV() {
    showToast("Menyiapkan export…");

    const rows = [];
    const CHUNK = 1000;
    let from = 0;

    while (true) {
      const to = from + CHUNK - 1;
      const { data, error } = await buildQuery()
        .order(sortKey, { ascending: sortAsc })
        .range(from, to);

      if (error) {
        showToast(`Export gagal: ${error.message}`, false);
        return;
      }

      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < CHUNK) break;
      from += CHUNK;
      if (from > 20000) break;
    }

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
    for (const r of rows) {
      lines.push(headers.map((h) => csvEscape(r[h])).join(","));
    }

    downloadFile(
      `db_export_${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8"
    );
    showToast("Export CSV berhasil");
  }

  function bind() {
    // =========================
    // 1) BUTTONS TOP TOOLBAR
    // =========================
    if (btnRefresh) {
      btnRefresh.onclick = async () => {
        await testConnection();
        await loadPage(1);
      };
    }

    if (btnAdd) {
      btnAdd.onclick = () => openModal("add");
    }

    if (btnExport) {
      btnExport.onclick = exportCSV;
    }

    if (btnPrev) {
      btnPrev.onclick = () => loadPage(currentPage - 1);
    }

    if (btnNext) {
      btnNext.onclick = () => loadPage(currentPage + 1);
    }

    // =========================
    // 2) MODAL BUTTONS
    // =========================
    if (modalClose) modalClose.onclick = closeModal;
    if (btnCancel) btnCancel.onclick = closeModal;

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (!modal || !modal.classList.contains("open")) return;
      if (e.key === "Escape") closeModal();
    });

    // submit form
    if (form) form.addEventListener("submit", save);

    // ✅ INI YANG PENTING: tombol ambil lokasi selalu aktif (tidak nunggu refresh)
    if (btnGeo) {
      btnGeo.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillCoordsFromCurrentLocation();
      };
    }

    // =========================
    // 3) FILTER / SEARCH / TABLE INPUT
    // =========================
    if (jenisSelect) jenisSelect.onchange = () => loadPage(1);

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener("change", () => loadPage(1));
    }

    if (tableInput) {
      tableInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && btnRefresh) btnRefresh.click();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadPage(1), 350);
      });
    }

    // =========================
    // 4) SORTABLE HEADERS
    // =========================
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.getAttribute("data-sort");
        if (!k) return;
        setSort(k);
      });
    });

    // =========================
    // 5) VALIDATION LISTENERS (FORM INPUTS)
    // =========================
    Object.keys(F).forEach((k) => {
      const input = F[k];
      if (!input) return;
      input.addEventListener("input", validateAll);
      input.addEventListener("blur", validateAll);
    });

    // =========================
    // 6) TABLE ACTIONS (EDIT/DEL/LOC)
    // =========================
    if (tbody) {
      tbody.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const act = btn.getAttribute("data-act");

        if (act === "loc") {
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
          return;
        }

        const dbId = btn.getAttribute("data-id");
        if (!act || !dbId) return;

        if (act === "del") return delRow(dbId);

        if (act === "edit") {
          const t = getTable();
          const { data, error } = await sb
            .from(t)
            .select("*")
            .eq(DB_PK, dbId)
            .limit(1);

          if (error || !data?.[0]) {
            showToast(
              `Gagal ambil data: ${error?.message || "not found"}`,
              false
            );
            return;
          }
          openModal("edit", data[0]);
        }
      });
    }
  }

  (async function start() {
    bind();
    await testConnection();
    await loadPage(1);
  })();
})();
