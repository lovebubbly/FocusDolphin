const params = new URLSearchParams(window.location.search);
const requestedLocale = params.get("lang");
const requestedTheme = params.get("theme");

if (params.get("capture") === "1") {
  document.documentElement.classList.add("capture");
}

const initialLocale = requestedLocale === "ko" ? "ko" : "en";
const initialTheme = requestedTheme === "light"
  ? "focuswhale-preview-light"
  : document.documentElement.dataset.defaultTheme ?? "focuswhale-preview";

function applyLocale(locale) {
  document.documentElement.lang = locale;
  document.querySelectorAll("[data-en-label][data-ko-label]").forEach((element) => {
    element.setAttribute("aria-label", locale === "ko" ? element.dataset.koLabel : element.dataset.enLabel);
  });
  document.querySelectorAll("[data-locale-button]").forEach((button) => {
    const selected = button.dataset.localeButton === locale;
    button.classList.toggle("btn-primary", selected);
    button.classList.toggle("btn-ghost", !selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function applyTheme(theme) {
  document.querySelectorAll("[data-theme-surface]").forEach((surface) => {
    surface.dataset.theme = theme;
  });
  document.querySelectorAll("[data-theme-button]").forEach((button) => {
    const selected = button.dataset.themeButton === theme;
    button.classList.toggle("btn-primary", selected);
    button.classList.toggle("btn-ghost", !selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

document.querySelectorAll("[data-locale-button]").forEach((button) => {
  button.addEventListener("click", () => applyLocale(button.dataset.localeButton));
});

document.querySelectorAll("[data-theme-button]").forEach((button) => {
  button.addEventListener("click", () => applyTheme(button.dataset.themeButton));
});

applyLocale(initialLocale);
applyTheme(initialTheme);
