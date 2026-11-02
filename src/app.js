(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('.theme-toggle');
  function refreshThemeButton() {
    const dark = root.dataset.theme === 'dark';
    const label = dark ? 'فعال‌کردن حالت روشن' : 'فعال‌کردن حالت تاریک';
    themeToggle?.setAttribute('aria-label', label);
    themeToggle?.setAttribute('aria-pressed', String(dark));
    if (themeToggle) themeToggle.title = dark ? 'حالت روشن' : 'حالت تاریک';
    const icon = themeToggle?.querySelector('.theme-icon');
    if (icon) icon.textContent = dark ? '☀' : '☾';
  }
  refreshThemeButton();
  themeToggle?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('binahayat-theme', root.dataset.theme); } catch {}
    refreshThemeButton();
  });

  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.nav');
  const trigger = document.querySelector('.works-trigger');
  const dropdown = document.querySelector('.works-dropdown');
  function closeDropdown() {
    dropdown?.classList.remove('dropdown-open');
    trigger?.setAttribute('aria-expanded', 'false');
  }
  function closeMenu() {
    nav?.classList.remove('nav-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'باز کردن منو');
    closeDropdown();
  }
  menuButton?.addEventListener('click', () => {
    const open = nav?.classList.toggle('nav-open');
    menuButton.setAttribute('aria-expanded', String(Boolean(open)));
    menuButton.setAttribute('aria-label', open ? 'بستن منو' : 'باز کردن منو');
    if (!open) closeDropdown();
  });
  trigger?.addEventListener('click', () => {
    const open = dropdown?.classList.toggle('dropdown-open');
    trigger.setAttribute('aria-expanded', String(Boolean(open)));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.nav-dropdown')) closeDropdown();
    if (!event.target.closest('.site-header')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const wasDropdownOpen = trigger?.getAttribute('aria-expanded') === 'true';
      const wasMenuOpen = menuButton?.getAttribute('aria-expanded') === 'true';
      closeMenu();
      if (wasDropdownOpen) trigger.focus();
      else if (wasMenuOpen) menuButton.focus();
    }
  });
  const desktop = matchMedia('(min-width: 1001px)');
  desktop.addEventListener('change', closeMenu);

  const slides = [...document.querySelectorAll('.hero-slider .slide')];
  const dots = [...document.querySelectorAll('.slider-dots button')];
  if (slides.length) {
    let current = 0;
    let timer;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    function schedule() {
      clearTimeout(timer);
      if (reduceMotion.matches || document.hidden) return;
      const duration = slides[current].querySelector('video')?.duration;
      timer = setTimeout(() => show((current + 1) % slides.length), Number.isFinite(duration) ? Math.max(duration * 1000, 4500) : 8000);
    }
    function show(index) {
      current = index;
      slides.forEach((slide, i) => {
        const active = i === index;
        slide.classList.toggle('slide-active', active);
        slide.setAttribute('aria-hidden', String(!active));
        dots[i]?.classList.toggle('active', active);
        dots[i]?.setAttribute('aria-pressed', String(active));
        const video = slide.querySelector('video');
        if (!video) return;
        if (active && !document.hidden && !reduceMotion.matches) {
          video.currentTime = 0;
          video.play().catch(() => {});
        } else video.pause();
      });
      schedule();
    }
    dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
    slides.forEach((slide, i) => {
      const video = slide.querySelector('video');
      video?.addEventListener('ended', () => { if (current === i) show((i + 1) % slides.length); });
      video?.addEventListener('loadedmetadata', () => { if (current === i) schedule(); });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearTimeout(timer); slides[current].querySelector('video')?.pause(); }
      else show(current);
    });
    reduceMotion.addEventListener('change', () => show(current));
    show(0);
  }

  const form = document.querySelector('.project-form');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    let status = form.querySelector('[role="status"]');
    if (!status) {
      status = document.createElement('p');
      status.className = 'form-error wide';
      status.setAttribute('role', 'status');
      form.append(status);
    }
    status.textContent = 'این نسخه پیش‌نمایش است. برای ارسال درخواست، راه ارتباطی استودیو باید تنظیم شود؛ اطلاعات شما ارسال نشده است.';
  });
})();
