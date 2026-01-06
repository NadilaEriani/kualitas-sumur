const SUPABASE_URL = "https://sanvsobyezkgyljknxvy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbnZzb2J5ZXprZ3lsamtueHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODY1MjEsImV4cCI6MjA4MTA2MjUyMX0._xjZQ9A5kFf3UEmlBzjD33VwSQQ1un5bxJl7HFIPr7c";

const PRIMARY_KEY = "id_sumur";
const PAGE_SIZE = 15;

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const el = (id) => document.getElementById(id);

const badge = el("db-badge");
const hint = el("db-hint");

const tableInput = el("db-table");
const searchInput = el("db-search");
const jenisSelect = el("db-jenis");

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

const sortIdInd = el("sort-id_sumur");
const sortKecInd = el("sort-kecamatan");

const F = {
  id_sumur: el("f-id_sumur"),
  kecamatan: el("f-kecamatan"),
  latitude: el("f-latitude"),
  longitude: el("f-longitude"),
  jenis_sumur: el("f-jenis_sumur"),
  pH: el("f-pH"),
  jarak_septictank_m: el("f-jarak_septictank_m"),
  jarak_selokan_m: el("f-jarak_selokan_m"),
  bau: el("f-bau"),
  rasa: el("f-rasa"),
};

const E = {
  id_sumur: el("e-id_sumur"),
  kecamatan: el("e-kecamatan"),
  latitude: el("e-latitude"),
  longitude: el("e-longitude"),
  pH: el("e-pH"),
  jarak_septictank_m: el("e-jarak_septictank_m"),
  jarak_selokan_m: el("e-jarak_selokan_m"),
};

let currentPage = 1;
let totalRows = 0;
let editingId = null;
let searchTimer = null;

let sortKey = PRIMARY_KEY; // default
let sortAsc = true;

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
  toast.textContent = msg;
  toast.classList.toggle("ok", ok);
  toast.classList.toggle("bad", !ok);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function getTable() {
  const t = (tableInput.value || "").trim();
  return t || "kualitas_air_sumur";
}

function setSort(newKey) {
  if (sortKey === newKey) sortAsc = !sortAsc;
  else {
    sortKey = newKey;
    sortAsc = true;
  }
  updateSortIndicators();
  loadPage(1);
}

function updateSortIndicators() {
  if (sortIdInd) sortIdInd.textContent = sortKey === "id_sumur" ? (sortAsc ? "↑" : "↓") : "↕";
  if (sortKecInd) sortKecInd.textContent = sortKey === "kecamatan" ? (sortAsc ? "↑" : "↓") : "↕";
}

function renderSkeletonRows(n = 8) {
  let html = "";
  for (let i = 0; i < n; i++) {
    html += `<tr>
      ${Array.from({ length: 10 })
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
  try {
    const t = getTable();
    const { error } = await sb.from(t).select(PRIMARY_KEY, { head: true }).limit(1);
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
  let q = sb.from(t).select("*", { count: "exact" });

  const s = (searchInput.value || "").trim();
  const jenis = (jenisSelect.value || "").trim();

  if (s) {
    const like = `%${s}%`;
    q = q.or(`id_sumur.ilike.${like},kecamatan.ilike.${like}`);
  }
  if (jenis) q = q.eq("jenis_sumur", jenis);

  return q;
}

function emptyState(msg, icon = "fa-circle-info") {
  tbody.innerHTML = `
    <tr>
      <td colspan="10" class="db-empty">
        <div class="empty-box">
          <i class="fa-solid ${icon}"></i>
          <div>${esc(msg)}</div>
        </div>
      </td>
    </tr>
  `;
}

async function loadPage(page) {
  currentPage = Math.max(1, page);
  pageEl.textContent = String(currentPage);

  renderSkeletonRows(7);

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

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
  for (const row of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${esc(row.id_sumur)}</b></td>
      <td>${esc(row.kecamatan)}</td>
      <td>${esc(row.jenis_sumur)}</td>
      <td>${esc(row.pH)}</td>
      <td>${esc(row.jarak_septictank_m)}</td>
      <td>${esc(row.jarak_selokan_m)}</td>
      <td>${esc(row.bau)}</td>
      <td>${esc(row.rasa)}</td>
      <td class="db-mono">${esc(row.latitude)}, ${esc(row.longitude)}</td>
      <td class="db-actions-col">
        <button class="db-mini" data-act="edit" data-id="${esc(row.id_sumur)}" aria-label="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="db-mini danger" data-act="del" data-id="${esc(row.id_sumur)}" aria-label="Hapus">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  btnPrev.disabled = currentPage <= 1;
  btnNext.disabled = currentPage * PAGE_SIZE >= totalRows;
}

function openModal(mode, row = null) {
  errBox.textContent = "";
  Object.values(E).forEach((x) => x && (x.textContent = ""));
  lastFocus = document.activeElement;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  if (mode === "add") {
    modalTitle.textContent = "Tambah Data";
    editingId = null;
    Object.keys(F).forEach((k) => (F[k].value = ""));
    F.jenis_sumur.value = "Sumur Bor";
    F.id_sumur.disabled = false;
  } else {
    modalTitle.textContent = "Edit Data";
    editingId = row?.id_sumur ?? null;

    F.id_sumur.value = row?.id_sumur ?? "";
    F.kecamatan.value = row?.kecamatan ?? "";
    F.latitude.value = row?.latitude ?? "";
    F.longitude.value = row?.longitude ?? "";
    F.jenis_sumur.value = row?.jenis_sumur ?? "Sumur Bor";
    F.pH.value = row?.pH ?? "";
    F.jarak_septictank_m.value = row?.jarak_septictank_m ?? "";
    F.jarak_selokan_m.value = row?.jarak_selokan_m ?? "";
    F.bau.value = row?.bau ?? "";
    F.rasa.value = row?.rasa ?? "";

    F.id_sumur.disabled = true;
  }

  // focus first
  setTimeout(() => F.id_sumur.focus(), 0);
  validateAll();
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  lastFocus && lastFocus.focus && lastFocus.focus();
}

/* ========= VALIDATION ========= */
function setFieldError(key, msg) {
  const box = E[key];
  if (box) box.textContent = msg || "";
}

function isValidPH(text) {
  const s = String(text ?? "").trim().replace(",", ".");
  if (!s) return true;
  if (/^[<>]\s*\d+(\.\d+)?$/.test(s)) return true;
  if (/^\d+(\.\d+)?$/.test(s)) return true;
  return false;
}

function validateAll() {
  let ok = true;

  const id = (F.id_sumur.value || "").trim();
  if (!id) {
    setFieldError("id_sumur", "ID Sumur wajib diisi.");
    ok = false;
  } else {
    setFieldError("id_sumur", "");
  }

  const latRaw = F.latitude.value;
  const lngRaw = F.longitude.value;

  if (latRaw !== "") {
    const lat = Number(latRaw);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setFieldError("latitude", "Latitude harus di rentang -90 s/d 90.");
      ok = false;
    } else setFieldError("latitude", "");
  } else setFieldError("latitude", "");

  if (lngRaw !== "") {
    const lng = Number(lngRaw);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setFieldError("longitude", "Longitude harus di rentang -180 s/d 180.");
      ok = false;
    } else setFieldError("longitude", "");
  } else setFieldError("longitude", "");

  if (!isValidPH(F.pH.value)) {
    setFieldError("pH", "Format pH tidak valid. Contoh: 6.9 / 7 / <7 / >7");
    ok = false;
  } else setFieldError("pH", "");

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

  if (btnSave) btnSave.disabled = !ok;
  return ok;
}

function getPayload() {
  const id = (F.id_sumur.value || "").trim();
  if (!id) return { error: "ID Sumur wajib diisi." };

  const lat = F.latitude.value === "" ? null : Number(F.latitude.value);
  const lng = F.longitude.value === "" ? null : Number(F.longitude.value);

  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90))
    return { error: "Latitude tidak valid." };
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
    return { error: "Longitude tidak valid." };

  if (!isValidPH(F.pH.value)) return { error: "Format pH tidak valid." };

  const septic =
    F.jarak_septictank_m.value === "" ? null : Number(F.jarak_septictank_m.value);
  const selokan =
    F.jarak_selokan_m.value === "" ? null : Number(F.jarak_selokan_m.value);

  if (septic !== null && (!Number.isFinite(septic) || septic < 0))
    return { error: "Jarak Septictank tidak valid." };
  if (selokan !== null && (!Number.isFinite(selokan) || selokan < 0))
    return { error: "Jarak Selokan tidak valid." };

  return {
    payload: {
      id_sumur: id,
      kecamatan: (F.kecamatan.value || "").trim() || null,
      latitude: lat,
      longitude: lng,
      jenis_sumur: (F.jenis_sumur.value || "").trim() || null,
      pH: (F.pH.value || "").trim() || null,
      jarak_septictank_m: septic,
      jarak_selokan_m: selokan,
      bau: (F.bau.value || "").trim() || null,
      rasa: (F.rasa.value || "").trim() || null,
    },
  };
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

  // INSERT
  if (!editingId) {
    const { error: e2 } = await sb.from(t).insert([payload]);
    if (e2) {
      errBox.textContent = e2.message;
      return;
    }
    showToast("Berhasil ditambahkan");
    closeModal();
    await loadPage(1);
    return;
  }

  // UPDATE
  const upd = { ...payload };
  delete upd.id_sumur;

  const { error: e3 } = await sb.from(t).update(upd).eq(PRIMARY_KEY, editingId);
  if (e3) {
    errBox.textContent = e3.message;
    return;
  }

  showToast("Berhasil diperbarui");
  closeModal();
  await loadPage(currentPage);
}

async function delRow(id) {
  const ok = confirm(`Hapus data ${id}?`);
  if (!ok) return;

  const t = getTable();
  const { error } = await sb.from(t).delete().eq(PRIMARY_KEY, id);
  if (error) {
    showToast(`Gagal hapus: ${error.message}`, false);
    return;
  }
  showToast("Berhasil dihapus");
  await loadPage(currentPage);
}

/* ========= EXPORT CSV ========= */
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
  const t = getTable();
  showToast("Menyiapkan export…");

  // ambil semua hasil filter (tanpa limit halaman) via paging range
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

    // safety (hindari infinite loop)
    if (from > 20000) break;
  }

  if (!rows.length) {
    showToast("Tidak ada data untuk diexport", false);
    return;
  }

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
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }

  const csv = lines.join("\n");
  const fname = `db_export_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(fname, csv, "text/csv;charset=utf-8");
  showToast("Export CSV berhasil");
}

/* ========= EVENTS ========= */
function bind() {
  btnRefresh.onclick = async () => {
    await testConnection();
    await loadPage(1);
  };

  btnAdd.onclick = () => openModal("add");
  modalClose.onclick = closeModal;
  btnCancel.onclick = closeModal;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC close + focus trap basic
  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;

    if (e.key === "Escape") closeModal();

    if (e.key === "Tab") {
      const focusables = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(focusables).filter((x) => !x.disabled);
      if (!list.length) return;

      const first = list[0];
      const last = list[list.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  form.addEventListener("submit", save);

  btnPrev.onclick = () => loadPage(currentPage - 1);
  btnNext.onclick = () => loadPage(currentPage + 1);

  jenisSelect.onchange = () => loadPage(1);

  tableInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnRefresh.click();
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadPage(1), 350);
  });

  // sort click (id_sumur & kecamatan)
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const k = th.getAttribute("data-sort");
      if (k === "id_sumur" || k === "kecamatan") setSort(k);
    });
  });

  // export
  btnExport.onclick = exportCSV;

  // realtime validation
  Object.keys(F).forEach((k) => {
    const input = F[k];
    if (!input) return;
    input.addEventListener("input", validateAll);
    input.addEventListener("blur", validateAll);
  });

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "del") return delRow(id);

    if (act === "edit") {
      const t = getTable();
      const { data, error } = await sb.from(t).select("*").eq(PRIMARY_KEY, id).limit(1);
      if (error || !data?.[0]) {
        showToast(`Gagal ambil data: ${error?.message || "not found"}`, false);
        return;
      }
      openModal("edit", data[0]);
    }
  });
}

(async function start() {
  bind();
  updateSortIndicators();
  await testConnection();
  await loadPage(1);
})();
