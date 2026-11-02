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
  const params = new URLSearchParams(location.search);
  const setupMode = params.get('setup') === 'email';
  const deliveryReady = form?.dataset.deliveryReady === 'true';
  const submitButton = form?.querySelector('button[type="submit"]');
  const originalSubmitLabel = submitButton?.innerHTML;
  function formStatus(message, kind = 'info') {
    let status = form.querySelector('[role="status"]');
    if (!status) {
      status = document.createElement('p');
      status.className = 'form-info wide';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      form.append(status);
    }
    status.className = `form-${kind} wide`;
    status.textContent = message;
  }
  function resetSubmitButton() {
    if (!submitButton) return;
    submitButton.disabled = !globalThis.BinahayatDocument || (!deliveryReady && !setupMode);
    submitButton.innerHTML = originalSubmitLabel;
    form.removeAttribute('aria-busy');
  }
  function setFormValue(name, value) {
    let input = form.querySelector(`input[name="${name}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.append(input);
    }
    input.value = value;
  }
  if (form) {
    resetSubmitButton();
    if (params.get('submitted') === '1') {
      formStatus('درخواست شما برای بررسی به استودیوی بی‌نهایت ارسال شد.', 'success');
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete('submitted');
      history.replaceState(null, '', cleanUrl);
    } else if (setupMode) {
      formStatus('حالت آزمایش ارسال ایمیل فعال است. پس از ارسال، تأیید ایمیل مقصد و دریافت پیوست Word بررسی می‌شود.');
    } else if (!deliveryReady) {
      formStatus('فرم ارسال درخواست در حال فعال‌سازی است. فعلاً برای ارتباط با استودیو به binahayatstudio.ai@gmail.com ایمیل بزنید.');
    }
    addEventListener('pageshow', resetSubmitButton);
  }
  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!deliveryReady && !setupMode) return;
    if (form.elements.namedItem('_honey')?.value) return;
    if (!form.reportValidity()) return;
    try {
      if (!globalThis.BinahayatDocument || typeof DataTransfer !== 'function') {
        throw new Error('document-generation-unavailable');
      }
      const values = {};
      for (const name of ['name', 'contact', 'type', 'timeline', 'brief']) {
        values[name] = String(form.elements.namedItem(name)?.value || '').trim();
      }
      if (!values.name || !values.contact || !values.brief) {
        formStatus('نام، راه ارتباطی و توضیح ایده را کامل کنید.', 'error');
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = 'در حال آماده‌سازی فایل Word…';
      form.setAttribute('aria-busy', 'true');
      const request = globalThis.BinahayatDocument.createRequestDocument(values);
      const attachment = new File([request.bytes], request.filename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const transfer = new DataTransfer();
      transfer.items.add(attachment);
      const fileInput = form.querySelector('input[name="attachment"]');
      fileInput.files = transfer.files;
      if (fileInput.files.length !== 1 || fileInput.files[0].size !== attachment.size) {
        throw new Error('attachment-unavailable');
      }
      const nextUrl = new URL(location.href);
      nextUrl.search = '';
      nextUrl.hash = '';
      nextUrl.searchParams.set('submitted', '1');
      if (setupMode) nextUrl.searchParams.set('setup', 'email');
      setFormValue('_next', nextUrl.href);
      setFormValue('request_id', request.requestId);
      setFormValue('submitted_at', request.submittedAt);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contact)) setFormValue('_replyto', values.contact);
      else form.querySelector('input[name="_replyto"]')?.remove();
      formStatus('فایل Word آماده شد. برای تکمیل ارسال به صفحهٔ امن ارسال فرم منتقل می‌شوید.');
      submitButton.textContent = 'در حال ارسال درخواست…';
      HTMLFormElement.prototype.submit.call(form);
    } catch {
      resetSubmitButton();
      formStatus('فایل Word آماده نشد و اطلاعات ارسال نشده است. دوباره تلاش کنید یا از نسخهٔ به‌روز مرورگر استفاده کنید.', 'error');
    }
  });
})();
