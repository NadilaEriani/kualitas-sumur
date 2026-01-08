(() => {
  "use strict";

  const SUPABASE_URL = "https://sanvsobyezkgyljknxvy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbnZzb2J5ZXprZ3lsamtueHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODY1MjEsImV4cCI6MjA4MTA2MjUyMX0._xjZQ9A5kFf3UEmlBzjD33VwSQQ1un5bxJl7HFIPr7c";

  const sb =
    window.supabase && typeof window.supabase.createClient === "function"
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

  const el = (id) => document.getElementById(id);
  const form = el("loginForm");
  const btnLogin = el("btnLogin");
  const toastBox = el("toast");

  function showToast(msg, ok = true) {
    if (!toastBox) return;
    toastBox.className = "toast show " + (ok ? "ok" : "bad");
    toastBox.textContent = msg;
    setTimeout(() => toastBox.classList.remove("show"), 2200);
  }

  async function init() {
    if (!sb) {
      document.documentElement.classList.remove("auth-check");
      showToast("Supabase SDK belum termuat.", false);
      return;
    }

    // ✅ kalau sudah login, langsung ke admin (tanpa nampilin halaman)
    const { data } = await sb.auth.getSession();
    if (data?.session) {
      window.location.replace("data-admin.html");
      return;
    }

    // ✅ kalau belum login, baru tampilkan halaman
    document.documentElement.classList.remove("auth-check");
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sb) return;

    const email = (el("email")?.value || "").trim();
    const password = (el("password")?.value || "").trim();

    if (!email || !password) {
      showToast("Lengkapi email & password.", false);
      return;
    }

    btnLogin.disabled = true;
    const old = btnLogin.textContent;
    btnLogin.textContent = "Memproses…";

    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      showToast("Login berhasil. Mengalihkan…", true);
      setTimeout(() => window.location.replace("data-admin.html"), 250);
    } catch (err) {
      showToast(err?.message || "Login gagal.", false);
      btnLogin.disabled = false;
      btnLogin.textContent = old || "Masuk";
    }
  });

  document.addEventListener("DOMContentLoaded", init);
})();
