(() => {
  "use strict";

  const SUPABASE_URL = "https://sanvsobyezkgyljknxvy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbnZzb2J5ZXprZ3lsamtueHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODY1MjEsImV4cCI6MjA4MTA2MjUyMX0._xjZQ9A5kFf3UEmlBzjD33VwSQQ1un5bxJl7HFIPr7c";

  const $ = (id) => document.getElementById(id);

  const tableName = ($("db-table")?.value || "sumur").trim() || "sumur";

  const client =
    window.supabase && typeof window.supabase.createClient === "function"
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

  // ===== UI ELEM =====
  const badge = $("db-badge");
  const hint = $("db-hint");
  const countEl = $("db-count");
  const totalEl = $("db-total");
  const pageEl = $("db-page");

  const searchEl = $("db-search");
  const phEl = $("db-ph");
  const jenisEl = $("db-jenis");
  const pageSizeEl = $("db-pagesize");

  const tbody = $("db-body");

  const btnExport = $("btn-export");
  const btnRefresh = $("btn-refresh");
  const btnAdd = $("btn-add");
  const btnPrev = $("btn-prev");
  const btnNext = $("btn-next");

  const toastEl = $("db-toast");

  // ===== MODAL ELEM =====
  const modal = $("db-modal");
  const modalTitle = $("modal-title");
  const modalClose = $("modal-close");
  const form = $("db-form");
  const btnCancel = $("btn-cancel");
  const btnSave = $("btn-save");
  const dbError = $("db-error");
  const btnGeo = $("btn-geo");

  const f = {
    kecamatan: $("f-kecamatan"),
    warna: $("f-warna"),
    kondisi_sumur: $("f-kondisi_sumur"),
    jenis_sumur: $("f-jenis_sumur"),
    lat: $("f-lat"),
    lng: $("f-lng"),
    ph: $("f-ph"),
    jarak_septictank_m: $("f-jarak_septictank_m"),
    jarak_selokan_m: $("f-jarak_selokan_m"),
    bau: $("f-bau"),
    rasa: $("f-rasa"),
  };

  const e = {
    lat: $("e-lat"),
    lng: $("e-lng"),
    ph: $("e-ph"),
    jarak_septictank_m: $("e-jarak_septictank_m"),
    jarak_selokan_m: $("e-jarak_selokan_m"),
  };

  // ===== STATE =====
  const state = {
    page: 1,
    pageSize: 10,
    sortBy: "created_at",
    sortAsc: false,
    editingId: null,
    // auto-detect coord column names
    coordLatKey: "lat",
    coordLngKey: "lng",
  };

  // ===== HELPERS =====
  function toast(msg, type = "ok") {
    if (!toastEl) return;
    toastEl.className = "db-toast show " + type;
    toastEl.textContent = msg;
    setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function setConnected(ok, msg = "") {
    if (!badge) return;
    badge.textContent = ok ? "Terhubung" : "Gagal";
    badge.classList.toggle("ok", ok);
    badge.classList.toggle("bad", !ok);
    if (hint) hint.textContent = msg || "";
  }

  function escHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalizePH(val) {
    if (val == null) return null;
    if (typeof val === "number") return val;
    const s = String(val).trim().replace(",", ".");
    const num = parseFloat(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(num) ? num : null;
  }

  function applyClientPHFilter(rows, phMode) {
    if (!phMode) return rows;
    return rows.filter((r) => {
      const v = normalizePH(r.ph);
      if (v == null) return false;
      if (phMode === "lt7") return v < 7;
      if (phMode === "eq7") return Math.abs(v - 7) < 0.00001;
      if (phMode === "gt7") return v > 7;
      return true;
    });
  }

  function detectCoordKeys(row) {
    if (!row) return;
    if ("lat" in row || "lng" in row) {
      state.coordLatKey = "lat";
      state.coordLngKey = "lng";
    } else if ("latitude" in row || "longitude" in row) {
      state.coordLatKey = "latitude";
      state.coordLngKey = "longitude";
    }
  }

  function gmapsLinkFromRow(r) {
    const lat = r?.[state.coordLatKey];
    const lng = r?.[state.coordLngKey];
    if (lat == null || lng == null) return "";
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  function getFilters() {
    return {
      q: (searchEl?.value || "").trim(),
      ph: phEl?.value || "",
      jenis: jenisEl?.value || "",
      pageSize: parseInt(pageSizeEl?.value || "10", 10) || 10,
    };
  }

  async function requireAuth() {
    if (!client) {
      document.documentElement.classList.remove("auth-check");
      setConnected(false, "Supabase SDK belum termuat.");
      return false;
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      window.location.replace("login.html");
      return false;
    }

    document.documentElement.classList.remove("auth-check");
    return true;
  }

  function openModal(mode, row = null) {
    if (!modal || !modalTitle || !form) {
      toast(
        "Modal CRUD belum terpasang di HTML (cek id db-modal / db-form).",
        "bad"
      );
      console.error(
        "Modal elements missing. Pastikan modal HTML lengkap dipasang."
      );
      return;
    }

    state.editingId = mode === "edit" ? row?.id ?? row?.uuid ?? null : null;
    modalTitle.textContent = mode === "edit" ? "Edit Data" : "Tambah Data";
    if (dbError) dbError.textContent = "";
    Object.values(e).forEach((x) => x && (x.textContent = ""));

    detectCoordKeys(row);

    // fill form
    f.kecamatan && (f.kecamatan.value = row?.kecamatan ?? "");
    f.warna && (f.warna.value = row?.warna ?? "");
    f.kondisi_sumur && (f.kondisi_sumur.value = row?.kondisi_sumur ?? "");
    f.jenis_sumur && (f.jenis_sumur.value = row?.jenis_sumur ?? "Sumur Bor");

    const latVal = row?.[state.coordLatKey] ?? "";
    const lngVal = row?.[state.coordLngKey] ?? "";
    f.lat && (f.lat.value = latVal === null ? "" : String(latVal));
    f.lng && (f.lng.value = lngVal === null ? "" : String(lngVal));

    f.ph && (f.ph.value = row?.ph ?? "");
    f.jarak_septictank_m &&
      (f.jarak_septictank_m.value = row?.jarak_septictank_m ?? "");
    f.jarak_selokan_m && (f.jarak_selokan_m.value = row?.jarak_selokan_m ?? "");
    f.bau && (f.bau.value = row?.bau ?? "");
    f.rasa && (f.rasa.value = row?.rasa ?? "");

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function validateForm(payload) {
    let ok = true;
    Object.values(e).forEach((x) => x && (x.textContent = ""));

    const lat = payload[state.coordLatKey];
    const lng = payload[state.coordLngKey];

    if (lat != null && (lat < -90 || lat > 90)) {
      e.lat && (e.lat.textContent = "Latitude harus di rentang -90 sampai 90.");
      ok = false;
    }
    if (lng != null && (lng < -180 || lng > 180)) {
      e.lng &&
        (e.lng.textContent = "Longitude harus di rentang -180 sampai 180.");
      ok = false;
    }

    const phNum = normalizePH(payload.ph);
    if (payload.ph && phNum == null) {
      e.ph &&
        (e.ph.textContent = "Format pH tidak valid (cth: 6.9 / 7 / <7 / >7).");
      ok = false;
    }
    if (phNum != null && (phNum < 0 || phNum > 14)) {
      e.ph && (e.ph.textContent = "pH umumnya 0–14. Periksa nilai pH.");
      ok = false;
    }

    if (payload.jarak_septictank_m != null && payload.jarak_septictank_m < 0) {
      e.jarak_septictank_m &&
        (e.jarak_septictank_m.textContent =
          "Jarak septictank tidak boleh negatif.");
      ok = false;
    }
    if (payload.jarak_selokan_m != null && payload.jarak_selokan_m < 0) {
      e.jarak_selokan_m &&
        (e.jarak_selokan_m.textContent = "Jarak selokan tidak boleh negatif.");
      ok = false;
    }

    return ok;
  }

  function buildPayload() {
    const latRaw = (f.lat?.value || "").trim();
    const lngRaw = (f.lng?.value || "").trim();

    const payload = {
      kecamatan: (f.kecamatan?.value || "").trim() || "-",
      warna: (f.warna?.value || "").trim(),
      kondisi_sumur: (f.kondisi_sumur?.value || "").trim(),
      jenis_sumur: f.jenis_sumur?.value || "Sumur Bor",
      ph: (f.ph?.value || "").trim(),
      jarak_septictank_m:
        (f.jarak_septictank_m?.value || "").trim() === ""
          ? null
          : Number(f.jarak_septictank_m.value),
      jarak_selokan_m:
        (f.jarak_selokan_m?.value || "").trim() === ""
          ? null
          : Number(f.jarak_selokan_m.value),
      bau: (f.bau?.value || "").trim(),
      rasa: (f.rasa?.value || "").trim(),
    };

    // coord keys (lat/lng atau latitude/longitude)
    payload[state.coordLatKey] = latRaw === "" ? null : Number(latRaw);
    payload[state.coordLngKey] = lngRaw === "" ? null : Number(lngRaw);

    return payload;
  }

  function renderRows(rows, startNo = 1) {
    if (!rows || rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="db-empty">
            <div class="empty-box">
              <i class="fa-solid fa-circle-info"></i>
              <div>Tidak ada data.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    detectCoordKeys(rows[0]);

    tbody.innerHTML = rows
      .map((r, idx) => {
        const no = startNo + idx;
        const gmaps = gmapsLinkFromRow(r);
        const lokasiCell = gmaps
          ? `<a class="link-btn" href="${gmaps}" target="_blank" rel="noopener">
               <i class="fa-solid fa-location-dot"></i> Buka
             </a>`
          : `<span class="muted">-</span>`;

        const rowId = r.id ?? r.uuid ?? "";

        return `
          <tr data-rowid="${escHtml(rowId)}">
            <td style="text-align:center;">${no}</td>
            <td>${escHtml(r.kecamatan ?? "-")}</td>
            <td>${escHtml(r.jenis_sumur ?? "-")}</td>
            <td>${escHtml(r.warna ?? "-")}</td>
            <td style="text-align:center;">${escHtml(r.ph ?? "-")}</td>
            <td style="text-align:center;">${escHtml(
              r.jarak_septictank_m ?? "-"
            )}</td>
            <td style="text-align:center;">${escHtml(
              r.jarak_selokan_m ?? "-"
            )}</td>
            <td>${escHtml(r.bau ?? "-")}</td>
            <td>${escHtml(r.rasa ?? "-")}</td>
            <td>${escHtml(r.kondisi_sumur ?? "-")}</td>
            <td>${lokasiCell}</td>
            <td class="db-actions-col">
              <button class="db-mini" data-action="edit" title="Edit">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="db-mini danger" data-action="delete" title="Hapus">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function fetchAllForPhFilter(baseQuery) {
    const { data, error } = await baseQuery.range(0, 9999);
    if (error) throw error;
    return data || [];
  }

  async function fetchPage() {
    const filt = getFilters();
    state.pageSize = filt.pageSize;

    const from = (state.page - 1) * state.pageSize;
    const to = from + state.pageSize - 1;

    try {
      let base = client.from(tableName).select("*", { count: "exact" });

      if (filt.jenis) base = base.eq("jenis_sumur", filt.jenis);

      if (filt.q) {
        const term = `%${filt.q}%`;
        base = base.or(
          [
            `kecamatan.ilike.${term}`,
            `bau.ilike.${term}`,
            `rasa.ilike.${term}`,
            `warna.ilike.${term}`,
            `kondisi_sumur.ilike.${term}`,
            `jenis_sumur.ilike.${term}`,
          ].join(",")
        );
      }

      base = base.order(state.sortBy, { ascending: state.sortAsc });

      let rows = [];
      let total = 0;

      if (filt.ph) {
        const all = await fetchAllForPhFilter(base);
        const filtered = applyClientPHFilter(all, filt.ph);
        total = filtered.length;
        rows = filtered.slice(from, from + state.pageSize);
      } else {
        const { data, count, error } = await base.range(from, to);
        if (error) throw error;
        rows = data || [];
        total = count ?? 0;
      }

      setConnected(true, "");
      totalEl.textContent = String(total);
      countEl.value = String(total);
      pageEl.textContent = String(state.page);

      renderRows(rows, from + 1);

      btnPrev.disabled = state.page <= 1;
      const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
      btnNext.disabled = state.page >= maxPage;
    } catch (err) {
      console.error(err);
      setConnected(false, err?.message || "Koneksi gagal");
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="db-empty">
            <div class="empty-box">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <div>Gagal memuat data.</div>
            </div>
          </td>
        </tr>
      `;
      toast(err?.message || "Gagal memuat data.", "bad");
    }
  }

  function wireSort() {
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (!key) return;

        if (state.sortBy === key) state.sortAsc = !state.sortAsc;
        else {
          state.sortBy = key;
          state.sortAsc = true;
        }
        state.page = 1;
        fetchPage();
      });
    });
  }

  function wireTableActions() {
    tbody.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;

      const tr = ev.target.closest("tr[data-rowid]");
      if (!tr) return;

      const rowId = tr.getAttribute("data-rowid");
      const action = btn.getAttribute("data-action");
      if (!rowId) return;

      if (action === "edit") {
        try {
          const { data, error } = await client
            .from(tableName)
            .select("*")
            .eq("id", rowId)
            .single();

          if (error) throw error;
          openModal("edit", data);
        } catch (err) {
          console.error(err);
          toast(err?.message || "Gagal membuka data untuk edit.", "bad");
        }
      }

      if (action === "delete") {
        const yes = confirm("Yakin ingin menghapus data ini?");
        if (!yes) return;

        try {
          const { error } = await client
            .from(tableName)
            .delete()
            .eq("id", rowId);
          if (error) throw error;

          toast("Data berhasil dihapus.", "ok");
          // kalau habis delete halaman kosong, mundur 1 page
          if (state.page > 1 && tbody.querySelectorAll("tr").length <= 1)
            state.page -= 1;
          fetchPage();
        } catch (err) {
          console.error(err);
          toast(err?.message || "Hapus data gagal.", "bad");
        }
      }
    });
  }

  function wireFilters() {
    const debounce = (fn, ms = 350) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    };

    const refetch = () => {
      state.page = 1;
      fetchPage();
    };

    searchEl?.addEventListener("input", debounce(refetch, 350));
    phEl?.addEventListener("change", refetch);
    jenisEl?.addEventListener("change", refetch);
    pageSizeEl?.addEventListener("change", refetch);

    btnRefresh?.addEventListener("click", () => fetchPage());

    btnPrev?.addEventListener("click", () => {
      if (state.page > 1) {
        state.page -= 1;
        fetchPage();
      }
    });

    btnNext?.addEventListener("click", () => {
      state.page += 1;
      fetchPage();
    });

    // export opsional (biar tombolnya tidak sia-sia)
    btnExport?.addEventListener("click", async () => {
      try {
        toast("Menyiapkan export…", "ok");
        let q = client.from(tableName).select("*").range(0, 9999);
        const { data, error } = await q;
        if (error) throw error;

        const filt = getFilters();
        const rows = applyClientPHFilter(data || [], filt.ph);

        if (!rows.length) {
          toast("Tidak ada data untuk diexport.", "bad");
          return;
        }

        const headers = Object.keys(rows[0]);
        const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
        const csv = [
          headers.join(","),
          ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `data_sumur_admin_${new Date()
          .toISOString()
          .slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        toast("Export CSV berhasil.", "ok");
      } catch (err) {
        console.error(err);
        toast(err?.message || "Export CSV gagal.", "bad");
      }
    });
  }

  function wireModal() {
    btnAdd?.addEventListener("click", () => openModal("add"));

    modalClose?.addEventListener("click", closeModal);
    btnCancel?.addEventListener("click", closeModal);

    modal?.addEventListener("click", (ev) => {
      if (ev.target === modal) closeModal();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && modal?.classList.contains("open"))
        closeModal();
    });

    btnGeo?.addEventListener("click", () => {
      if (!navigator.geolocation) {
        toast("Browser tidak mendukung GPS.", "bad");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          f.lat.value = pos.coords.latitude.toFixed(6);
          f.lng.value = pos.coords.longitude.toFixed(6);
          toast("Lokasi berhasil diambil.", "ok");
        },
        () => toast("Gagal mengambil lokasi.", "bad"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (dbError) dbError.textContent = "";

      const payload = buildPayload();
      const ok = validateForm(payload);
      if (!ok) {
        toast("Periksa input yang merah.", "bad");
        return;
      }

      btnSave && (btnSave.disabled = true);

      try {
        if (state.editingId) {
          const { error } = await client
            .from(tableName)
            .update(payload)
            .eq("id", state.editingId);
          if (error) throw error;

          toast("Data berhasil diperbarui.", "ok");
        } else {
          const { error } = await client.from(tableName).insert(payload);
          if (error) throw error;

          toast("Data berhasil ditambahkan.", "ok");
        }

        closeModal();
        fetchPage();
      } catch (err) {
        console.error(err);
        const msg = err?.message || "Gagal menyimpan data.";
        if (dbError) dbError.textContent = msg;
        toast(msg, "bad");
      } finally {
        btnSave && (btnSave.disabled = false);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await requireAuth())) return;

    $("btnLogout")?.addEventListener("click", async () => {
      await client.auth.signOut();
      window.location.replace("login.html");
    });

    // test koneksi
    try {
      const { error } = await client.from(tableName).select("id").range(0, 0);
      if (error) throw error;
      setConnected(true, `Table: ${tableName}`);
    } catch (err) {
      console.error(err);
      setConnected(false, err?.message || "Koneksi gagal");
    }

    wireSort();
    wireFilters();
    wireModal();
    wireTableActions();
    fetchPage();
  });
})();
