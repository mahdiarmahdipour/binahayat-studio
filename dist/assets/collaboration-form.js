(() => {
  'use strict';
  const form = document.querySelector('.project-form');
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.innerHTML;
  const openedAt = Date.now();
  const config = globalThis.BinahayatCollaborationConfig;
  let endpoint = null;
  try {
    const candidate = new URL(config?.endpoint || '');
    if (candidate.protocol === 'https:' && candidate.hostname === 'script.google.com' &&
      !candidate.username && !candidate.password && !candidate.port && !candidate.search && !candidate.hash &&
      /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(candidate.pathname)) endpoint = candidate.href;
  } catch { /* An unconfigured form remains disabled. */ }
  const ready = config?.enabled === true && !!endpoint && typeof globalThis.crypto?.getRandomValues === 'function';
  const fieldNames = ['name', 'contact', 'type', 'timeline', 'brief'];
  let active = null;
  let retry = null;

  const status = document.createElement('p');
  status.className = 'form-info wide';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.append(status);
  function announce(message, kind = 'info') {
    status.className = `form-${kind} wide`;
    status.textContent = message;
  }
  function readValues() {
    return Object.fromEntries(fieldNames.map(name => [name, String(form.elements.namedItem(name)?.value || '').trim()]));
  }
  function randomBytes(size) {
    return globalThis.crypto.getRandomValues(new Uint8Array(size));
  }
  function hex(bytes) {
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }
  function requestId() {
    const bytes = randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = hex(bytes);
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }
  function cleanupAttempt() {
    if (!active) return;
    clearTimeout(active.timer);
    active.postForm.remove();
    active.frame.remove();
    for (const [control, wasDisabled] of active.controls) control.disabled = wasDisabled;
    active = null;
    form.removeAttribute('aria-busy');
    button.innerHTML = originalLabel;
    button.disabled = !ready;
  }
  function trustedOrigin(value) {
    try {
      const origin = new URL(value);
      return origin.protocol === 'https:' && !origin.port &&
        (origin.hostname === 'script.google.com' || /^[a-z0-9-]+\.googleusercontent\.com$/.test(origin.hostname));
    } catch { return false; }
  }

  addEventListener('message', event => {
    if (!active || !trustedOrigin(event.origin) || !event.source) return;
    const result = event.data;
    if (!result || typeof result !== 'object' || result.type !== 'binahayat:collaboration-result' ||
      result.requestId !== active.payload.requestId || result.nonce !== active.payload.nonce ||
      !['sent', 'saved', 'error'].includes(result.status)) return;
    // Apps Script's response is nested in Google's sandbox iframe, so its source may
    // differ from frame.contentWindow. Only accept a descendant of this window.
    try { if (event.source.top !== window) return; } catch { return; }
    cleanupAttempt();
    if (result.status === 'sent' || result.status === 'saved') {
      retry = null;
      form.reset();
      announce('درخواست شما ثبت شد. پس از بررسی با شما تماس می‌گیریم.', 'success');
    } else {
      const invalid = result.code === 'invalid_request' || result.code === 'invalid_fields';
      announce(invalid ? 'اطلاعات فرم را بررسی کنید و دوباره تلاش کنید.' :
        'ثبت درخواست کامل نشد. لطفاً دوباره تلاش کنید یا با ایمیل استودیو در ارتباط باشید.', 'error');
    }
  });

  button.disabled = !ready;
  if (!ready) {
    announce('فرم ارسال درخواست در حال فعال‌سازی است. فعلاً برای ارتباط با استودیو به binahayatstudio.ai@gmail.com ایمیل بزنید.');
  }
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    if (active) {
      cleanupAttempt();
      announce('تأیید ثبت دریافت نشد. برای بررسی و تکمیل، دوباره دکمهٔ ثبت درخواست را بزنید.', 'error');
    }
    button.disabled = !ready;
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!ready || active || !form.reportValidity()) return;
    if (form.elements.namedItem('website')?.value) return;
    const values = readValues();
    if (!values.name || !values.contact || !values.brief) {
      announce('نام، راه ارتباطی و توضیح ایده را کامل کنید.', 'error');
      return;
    }
    try {
      const key = JSON.stringify(values);
      if (!retry || retry.key !== key) {
        retry = { key, payload: {
          requestId: requestId(), nonce: hex(randomBytes(32)), ...values,
          website: '', startedAt: openedAt
        } };
      }
      const frame = document.createElement('iframe');
      frame.name = `binahayat-delivery-${requestId()}`;
      frame.title = 'ارسال درخواست همکاری';
      frame.hidden = true;
      frame.setAttribute('aria-hidden', 'true');
      const postForm = document.createElement('form');
      postForm.hidden = true;
      postForm.method = 'POST';
      postForm.action = endpoint;
      postForm.enctype = 'application/x-www-form-urlencoded';
      postForm.target = frame.name;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'payload';
      input.value = JSON.stringify(retry.payload);
      postForm.append(input);
      const controls = [...form.querySelectorAll('input, select, textarea, button')].map(control => [control, control.disabled]);
      active = { payload: retry.payload, frame, postForm, controls, timer: null };
      for (const [control] of controls) control.disabled = true;
      form.setAttribute('aria-busy', 'true');
      button.textContent = 'در حال ثبت درخواست…';
      announce('درخواست شما در حال ثبت است. لطفاً کمی صبر کنید.');
      document.body.append(frame, postForm);
      active.timer = setTimeout(() => {
        cleanupAttempt();
        announce('تأیید ثبت دریافت نشد؛ ممکن است درخواست ثبت شده باشد. برای بررسی و تکمیل، دوباره دکمهٔ ثبت درخواست را بزنید.', 'error');
      }, 90000);
      // A normal form POST supports Google's response redirect. Only its matching
      // postMessage acknowledgment proves processing; iframe load is not success.
      HTMLFormElement.prototype.submit.call(postForm);
    } catch {
      cleanupAttempt();
      announce('ثبت درخواست کامل نشد. لطفاً دوباره تلاش کنید یا از نسخهٔ به‌روز مرورگر استفاده کنید.', 'error');
    }
  });
})();
