const SUPABASE_URL = "https://sanvsobyezkgyljknxvy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbnZzb2J5ZXprZ3lsamtueHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODY1MjEsImV4cCI6MjA4MTA2MjUyMX0._xjZQ9A5kFf3UEmlBzjD33VwSQQ1un5bxJl7HFIPr7c";

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

const modal = el("db-modal");
const modalTitle = el("modal-title");
const modalClose = el("modal-close");
const form = el("db-form");
const errBox = el("db-error");

const btnCancel = el("btn-cancel");
const toast = el("db-toast");

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

let currentPage = 1;
let totalRows = 0;
let editingId = null;
let searchTimer = null;

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

async function testConnection() {
  try {
    const t = getTable();
    const { error } = await sb
      .from(t)
      .select(PRIMARY_KEY, { head: true })
      .limit(1);
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

async function loadPage(page) {
  currentPage = Math.max(1, page);
  pageEl.textContent = String(currentPage);

  tbody.innerHTML = `<tr><td colspan="10" class="db-empty">Memuat data…</td></tr>`;

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await buildQuery()
    .order(PRIMARY_KEY, { ascending: true })
    .range(from, to);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="10" class="db-empty">Error: ${esc(
      error.message
    )}</td></tr>`;
    totalRows = 0;
    totalEl.textContent = "0";
    return;
  }

  totalRows = count ?? 0;
  totalEl.textContent = String(totalRows);

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="db-empty">Tidak ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  for (const row of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(row.id_sumur)}</td>
      <td>${esc(row.kecamatan)}</td>
      <td>${esc(row.jenis_sumur)}</td>
      <td>${esc(row.pH)}</td>
      <td>${esc(row.jarak_septictank_m)}</td>
      <td>${esc(row.jarak_selokan_m)}</td>
      <td>${esc(row.bau)}</td>
      <td>${esc(row.rasa)}</td>
      <td class="db-mono">${esc(row.latitude)}, ${esc(row.longitude)}</td>
      <td class="db-actions-col">
        <button class="db-mini" data-act="edit" data-id="${esc(row.id_sumur)}">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="db-mini danger" data-act="del" data-id="${esc(
          row.id_sumur
        )}">
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

    F.id_sumur.disabled = true; // PK tidak diubah saat edit
  }
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function getPayload() {
  const id = (F.id_sumur.value || "").trim();
  if (!id) return { error: "ID Sumur wajib diisi." };

  const lat = F.latitude.value === "" ? null : Number(F.latitude.value);
  const lng = F.longitude.value === "" ? null : Number(F.longitude.value);

  if (lat !== null && !Number.isFinite(lat))
    return { error: "Latitude tidak valid." };
  if (lng !== null && !Number.isFinite(lng))
    return { error: "Longitude tidak valid." };

  const septic =
    F.jarak_septictank_m.value === ""
      ? null
      : Number(F.jarak_septictank_m.value);
  const selokan =
    F.jarak_selokan_m.value === "" ? null : Number(F.jarak_selokan_m.value);

  if (septic !== null && !Number.isFinite(septic))
    return { error: "Jarak Septictank tidak valid." };
  if (selokan !== null && !Number.isFinite(selokan))
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

  // UPDATE (by PK)
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

/* EVENTS */
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

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "del") return delRow(id);

    if (act === "edit") {
      const t = getTable();
      const { data, error } = await sb
        .from(t)
        .select("*")
        .eq(PRIMARY_KEY, id)
        .limit(1);
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
  await testConnection();
  await loadPage(1);
})();
