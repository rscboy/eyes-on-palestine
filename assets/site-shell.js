(function () {
  if (window.__echoesSiteShellLoaded) return;
  window.__echoesSiteShellLoaded = true;

  const isAdmin = /\/admin(?:\.html)?$/i.test(window.location.pathname);
  if (isAdmin) return;

  const home = "https://echoesofgaza.org";
  const navHtml = `
    <header class="site-shell-header" data-site-shell="header">
      <div class="site-shell-inner">
        <a href="${home}" class="site-shell-logo">Echoes of Gaza</a>
        <nav class="site-shell-nav" aria-label="Main navigation">
          <span class="site-shell-menu-wrap">
            <button class="site-shell-menu-button" type="button">Archive</button>
            <span class="site-shell-menu">
              <span class="site-shell-menu-panel">
                <a href="${home}/#articles">Articles</a>
                <a href="${home}/#books">Books</a>
                <a href="${home}/#videos">Interviews</a>
                <a href="${home}/#films">Documentaries</a>
              </span>
            </span>
          </span>
          <span class="site-shell-menu-wrap">
            <button class="site-shell-menu-button" type="button">Tools</button>
            <span class="site-shell-menu">
              <span class="site-shell-menu-panel">
                <a href="${home}/#narrative-test-section">Narratives</a>
                <a href="${home}/#casualty-graph">Timeline</a>
                <a href="${home}/#bias-tool-controls">Racial Bias Tool</a>
              </span>
            </span>
          </span>
          <a href="${home}/#geolocation">Maps</a>
          <a href="${home}/#victims">Victims</a>
          <span class="site-shell-menu-wrap">
            <button class="site-shell-menu-button" type="button">Resources</button>
            <span class="site-shell-menu">
              <span class="site-shell-menu-panel">
                <a href="${home}/#quotes">Quotes & Resources</a>
                <a href="${home}/blog">Voices</a>
                <a href="${home}/events">Events</a>
                <a href="${home}/about">About</a>
                <a href="${home}/about#faq">FAQ</a>
              </span>
            </span>
          </span>
          <a href="${home}/collab" class="site-shell-submit">Submit Evidence</a>
        </nav>
        <button class="site-shell-mobile-button" type="button" aria-label="Open menu" aria-expanded="false">
          <span class="site-shell-mobile-button-text">Menu</span>
          <span class="site-shell-mobile-button-mark" aria-hidden="true"></span>
        </button>
      </div>
    </header>
    <div class="site-shell-mobile" data-site-shell="mobile" aria-hidden="true">
      <div class="site-shell-mobile-top">
        <a href="${home}" class="site-shell-logo">Echoes of Gaza</a>
        <button class="site-shell-mobile-close" type="button" aria-label="Close menu"><span></span><span></span></button>
      </div>
      <nav class="site-shell-mobile-links" aria-label="Mobile navigation">
        <a href="${home}/#articles">Archive</a>
        <a href="${home}/#casualty-graph">Timeline</a>
        <a href="${home}/#bias-tool-controls">Racial Bias Tool</a>
        <a href="${home}/#geolocation">Maps</a>
        <a href="${home}/#victims">Victims</a>
        <a href="${home}/events">Events</a>
        <a href="${home}/blog">Voices</a>
        <a href="${home}/about">About</a>
        <a href="${home}/collab" class="site-shell-submit">Submit Evidence</a>
      </nav>
    </div>`;

  const footerHtml = `
    <footer class="site-shell-footer" data-site-shell="footer">
      <div class="site-shell-footer-inner">
        <div class="site-shell-footer-main">
          <div class="site-shell-footer-brand">
            <a href="${home}" class="site-shell-logo">Echoes of Gaza</a>
            <p>Preserving truth, resisting erasure.</p>
            <div class="site-shell-social" aria-label="Echoes of Gaza social media">
              <a href="https://www.instagram.com/echoesofgaza" target="_blank" rel="noopener noreferrer" aria-label="Echoes of Gaza on Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5"></rect>
                  <circle cx="12" cy="12" r="4"></circle>
                  <circle cx="17.5" cy="6.5" r="1"></circle>
                </svg>
                <span>Instagram</span>
              </a>
              <a href="https://www.facebook.com/p/Echoes-of-Gaza-A-Historical-Archive-61584294577441/" target="_blank" rel="noopener noreferrer" aria-label="Echoes of Gaza on Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.6.4-1 1-1Z"></path>
                </svg>
                <span>Facebook</span>
              </a>
            </div>
            <div id="google_translate_element"></div>
          </div>
          <div class="site-shell-footer-grid">
            <div>
              <h4>Archive</h4>
              <ul>
                <li><a href="${home}/#articles">Articles</a></li>
                <li><a href="${home}/#victims">Martyrs</a></li>
                <li><a href="${home}/primary">Primary Sources</a></li>
              </ul>
            </div>
            <div>
              <h4>Resources</h4>
              <ul>
                <li><a href="${home}/#quotes">Quotes</a></li>
                <li><a href="${home}/blog">Voices</a></li>
                <li><a href="${home}/about">About & FAQ</a></li>
                <li><a href="https://data.techforpalestine.org/api/v2/killed-in-gaza.min.json" target="_blank" rel="noopener noreferrer">Raw Data</a></li>
              </ul>
            </div>
            <div>
              <h4>Support</h4>
              <ul>
                <li><a href="https://buymeacoffee.com/echoesofgaza" target="_blank" rel="noopener noreferrer">Donate</a></li>
                <li><a href="https://www.patreon.com/c/EchoesofGaza" target="_blank" rel="noopener noreferrer">Monthly Support</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div class="site-shell-footer-bottom">
          <p>© 2026 Echoes of Gaza. <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>.</p>
          <a href="${home}/admin.html">Admin Portal</a>
        </div>
      </div>
    </footer>`;

  function removeExistingShell() {
    const hadExistingGlobalHeader = Boolean(document.querySelector("header.nav-glass, header[data-site-shell='header'], #mobile-menu"));
    document.querySelectorAll("header.nav-glass, [data-site-shell], #mobile-menu").forEach((el) => el.remove());
    document.querySelectorAll("body > header").forEach((header) => {
      if (header.nextElementSibling && header.nextElementSibling.id === "app-root") header.remove();
    });
    document.querySelectorAll("footer#footer, body > footer").forEach((el) => el.remove());
    return hadExistingGlobalHeader;
  }

  function setupMobileMenu() {
    const openButton = document.querySelector(".site-shell-mobile-button");
    const closeButton = document.querySelector(".site-shell-mobile-close");
    const mobile = document.querySelector(".site-shell-mobile");
    if (!openButton || !closeButton || !mobile) return;
    const setOpen = (open) => {
      mobile.classList.toggle("is-open", open);
      mobile.setAttribute("aria-hidden", String(!open));
      openButton.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    };
    openButton.addEventListener("click", () => setOpen(true));
    closeButton.addEventListener("click", () => setOpen(false));
    mobile.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  }

  function setupTranslate() {
    window.googleTranslateElementInit = function () {
      const TranslateElement = window.google?.translate?.TranslateElement;
      if (typeof TranslateElement !== "function" || !document.getElementById("google_translate_element")) return;
      const inlineLayout = TranslateElement.InlineLayout;
      new TranslateElement({
        pageLanguage: "en",
        includedLanguages: "en,ar,he",
        layout: inlineLayout ? inlineLayout.SIMPLE : undefined
      }, "google_translate_element");
    };

    if (window.google?.translate) {
      window.googleTranslateElementInit();
      return;
    }

    if (!document.querySelector('script[src*="translate.google.com/translate_a/element.js"]')) {
      const script = document.createElement("script");
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      document.body.appendChild(script);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const hadExistingGlobalHeader = removeExistingShell();
    document.body.insertAdjacentHTML("afterbegin", navHtml);
    document.body.insertAdjacentHTML("beforeend", footerHtml);
    if (!hadExistingGlobalHeader) document.body.classList.add("site-shell-pad");
    setupMobileMenu();
    setupTranslate();
  });
})();
