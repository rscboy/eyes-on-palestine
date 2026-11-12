// Reuse existing controls and content, restoring their exact DOM positions on desktop.
document.addEventListener('DOMContentLoaded', () => {
  const phone = window.matchMedia('(max-width: 640px)');
  const statistics = document.getElementById('mobile-statistics-content');
  const elements = ['.hero-stats-grid', '.archive-methodology', '.hero-actions'].map(selector => {
    const element = document.querySelector(selector);
    const anchor = document.createComment('Desktop content position');
    element.before(anchor);
    return { element, anchor };
  });
  const search = document.getElementById('article-search');
  const originalPlaceholder = search.placeholder;
  const grid = document.getElementById('article-grid');
  const adaptActions = () => {
    grid.querySelectorAll('.article-actions').forEach(actions => {
      const existing = actions.querySelector('.mobile-article-more');
      if (phone.matches && !existing) {
        const secondary = [...actions.children].slice(1);
        const more = document.createElement('details');
        more.className = 'mobile-article-more';
        const summary = document.createElement('summary');
        summary.textContent = 'More';
        summary.setAttribute('aria-label', 'More article actions');
        const panel = document.createElement('div');
        panel.className = 'mobile-article-more-panel';
        panel.append(...secondary);
        more.append(summary, panel);
        actions.append(more);
      } else if (!phone.matches && existing) {
        actions.append(...existing.querySelector('.mobile-article-more-panel').children);
        existing.remove();
      }
    });
  };
  new MutationObserver(adaptActions).observe(grid, { childList: true });
  document.addEventListener('click', event => {
    document.querySelectorAll('.mobile-article-more[open]').forEach(menu => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.mobile-article-more[open]').forEach(menu => {
      menu.open = false;
      menu.querySelector('summary').focus();
    });
  });
  const layout = () => {
    elements.forEach(({ element, anchor }) => {
      if (phone.matches) statistics.append(element);
      else anchor.after(element);
    });
    adaptActions();
    search.placeholder = phone.matches ? 'Search the archive' : originalPlaceholder;
  };
  layout();
  phone.addEventListener('change', layout);
  document.querySelector('.mobile-search-entry').addEventListener('click', event => {
    event.preventDefault();
    search.focus({ preventScroll: true });
    document.getElementById('articles').scrollIntoView({ behavior: 'instant' });
  });
  document.getElementById('mobile-reset-filters').addEventListener('click', () => {
    document.getElementById('clear-button').click();
  });
  document.getElementById('toggle-filter-btn').addEventListener('click', () => queueMicrotask(() => {
    if (phone.matches && !document.getElementById('filter-controls').classList.contains('hidden')) {
      document.getElementById('filter-controls').scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }));
});
