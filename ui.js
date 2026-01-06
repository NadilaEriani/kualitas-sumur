const THEME_KEY = "sig-theme-preference";

function getTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeUI();
}

function toggleTheme() {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  window.AppUI?.toast?.(next === "dark" ? "Mode gelap diaktifkan" : "Mode terang diaktifkan");
}

function updateThemeUI() {
  const theme = getTheme();
  const btns = document.querySelectorAll("[data-theme-toggle]");
  btns.forEach((btn) => {
    const icon = btn.querySelector("i");
    const span = btn.querySelector("span");
    if (theme === "dark") {
      if (icon) icon.className = "fa-solid fa-moon";
      if (span) span.textContent = "Dark";
    } else {
      if (icon) icon.className = "fa-solid fa-sun";
      if (span) span.textContent = "Light";
    }
  });
}

setTheme(getTheme());

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem(THEME_KEY)) {
    setTheme(e.matches ? "dark" : "light");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const btns = document.querySelectorAll("[data-theme-toggle]");
  btns.forEach((btn) => btn.addEventListener("click", toggleTheme));
});

const toast = (function () {
  let container = null;
  let timeout = null;

  function show(message, success = true) {
    if (!container) {
      container = document.createElement("div");
      container.className = "toast";
      document.body.appendChild(container);
    }

    clearTimeout(timeout);
    container.textContent = message;
    container.classList.remove("ok", "bad", "show");
    if (success === true) container.classList.add("ok");
    else if (success === false) container.classList.add("bad");
    setTimeout(() => container.classList.add("show"), 10);
    timeout = setTimeout(() => container.classList.remove("show"), 3000);
  }

  return { show };
})();

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add("is-visible"), index * 100);
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: "-50px" }
);

document.addEventListener("DOMContentLoaded", () => {
  const reveals = document.querySelectorAll("[data-reveal]");
  reveals.forEach((el) => revealObserver.observe(el));
});

function copyToClipboard(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return Promise.resolve();
}

function showLoading(message = "Memuat...") {
  let loader = document.getElementById("app-loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "app-loader";
    loader.style.cssText = `position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);z-index:10000;`;
    loader.innerHTML = `<div style="text-align:center;color:#f8fafc;"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;"></i><div style="margin-top:12px;" id="loader-text">${message}</div></div>`;
    document.body.appendChild(loader);
  } else {
    const text = loader.querySelector("#loader-text");
    if (text) text.textContent = message;
    loader.style.display = "grid";
  }
}

function hideLoading() {
  const loader = document.getElementById("app-loader");
  if (loader) loader.style.display = "none";
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function formatNumber(num, decimals = 0) {
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^[\d\s\-\+\(\)]+$/.test(phone);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href === "#" || !href) return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
});

let lastScroll = 0;
window.addEventListener("scroll", () => {
  const nav = document.querySelector(".topnav");
  if (!nav) return;
  const currentScroll = window.pageYOffset;
  if (currentScroll > 100) {
    nav.style.boxShadow = "0 10px 25px rgba(0,0,0,0.12)";
  } else {
    nav.style.boxShadow = "none";
  }
  lastScroll = currentScroll;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal.open, .db-modal.open").forEach((modal) => {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    });
  }
});

window.AppUI = {
  toast: toast.show,
  copyToClipboard,
  showLoading,
  hideLoading,
  debounce,
  formatNumber,
  formatDate,
  validateEmail,
  validatePhone,
  getTheme,
  setTheme,
  toggleTheme,
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#year").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
});