/* Anonymous web app: private Drive archive, fixed-recipient email, same-page acknowledgment.
 * Run setupStudio once as the owner; deploy as owner with access "Anyone".
 * Never publish this folder or add sharing permissions to request files.
 */
const STUDIO_ = Object.freeze({
  recipient: 'binahayatstudio.ai@gmail.com',
  origin: 'https://mahdiarmahdipour.github.io',
  folderName: 'Binahayat Studio - Collaboration Requests',
  maxRawBytes: 150000,
  maxJsonBytes: 30000,
  dailyFiles: 100,
  dailyMail: 90,
  journalDays: 7,
  docxMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
});

function setupStudio() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const properties = PropertiesService.getScriptProperties();
    let folderId = properties.getProperty('FOLDER_ID');
    if (folderId) {
      const folder = Drive.Files.get(folderId, { fields: 'id,mimeType,trashed' });
      if (folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('Configured request folder is unavailable.');
      }
    } else {
      const folder = Drive.Files.create({
        name: STUDIO_.folderName,
        mimeType: 'application/vnd.google-apps.folder',
        appProperties: { binahayatArchive: 'collaboration-v1' }
      }, null, { fields: 'id' });
      properties.setProperty('FOLDER_ID', folder.id);
    }
    // Explicitly touch the send-only service so initial owner authorization covers email.
    MailApp.getRemainingDailyQuota();
    const installed = ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'processPendingRequests');
    if (!installed) ScriptApp.newTrigger('processPendingRequests').timeBased().everyMinutes(30).create();
    console.log('Private collaboration archive is ready.');
    return 'Private collaboration archive is ready.';
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><p>فرم همکاری از وب‌سایت استودیو در دسترس است.</p></html>');
}

function doPost(event) {
  let payload = {};
  let request;
  try {
    if (!event || !event.postData || !Number.isFinite(Number(event.postData.length)) ||
        Number(event.postData.length) > STUDIO_.maxRawBytes ||
        typeof event.parameter?.payload !== 'string') throw studioError_('invalid_request');
    const raw = event.parameter.payload;
    if (Utilities.newBlob(raw).getBytes().length > STUDIO_.maxJsonBytes) throw studioError_('invalid_request');
    payload = JSON.parse(raw);
    request = validateStudioRequest_(payload);
  } catch (error) {
    return studioResponse_(payload, 'error', error.studioCode || 'invalid_request');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return studioResponse_(request, 'error', 'busy');
  try {
    const result = persistAndSendStudioRequest_(request);
    return studioResponse_(request, result.status, result.code);
  } catch (error) {
    // No visitor fields or exception text are written to execution logs.
    console.warn('Collaboration processing stopped: ' + (error.studioCode || 'service_error'));
    return studioResponse_(request, 'error', error.studioCode || 'service_error');
  } finally {
    lock.releaseLock();
  }
}

function studioError_(code) {
  const error = new Error(code);
  error.studioCode = code;
  return error;
}

function validateStudioRequest_(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw studioError_('invalid_request');
  const allowed = ['requestId', 'nonce', 'name', 'contact', 'type', 'timeline', 'brief', 'website', 'startedAt'];
  if (Object.keys(payload).some(key => !allowed.includes(key))) throw studioError_('invalid_request');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(payload.requestId || '') ||
      !/^[a-f0-9]{64}$/.test(payload.nonce || '')) throw studioError_('invalid_request');
  if (typeof payload.startedAt !== 'number' || !Number.isFinite(payload.startedAt) || payload.startedAt <= 0) {
    throw studioError_('invalid_request');
  }
  if (typeof payload.website !== 'string' || payload.website.trim()) throw studioError_('invalid_request');
  const request = { requestId: payload.requestId, nonce: payload.nonce };
  const limits = { name: 120, contact: 254, type: 60, timeline: 60, brief: 6000 };
  for (const key of Object.keys(limits)) {
    if (typeof payload[key] !== 'string' || payload[key].length > limits[key]) throw studioError_('invalid_fields');
    const value = payload[key].replace(/\r\n?/g, '\n').trim();
    for (const character of value) {
      const point = character.codePointAt(0);
      if ((point < 32 && point !== 9 && point !== 10) || point === 127 ||
          (point >= 0xd800 && point <= 0xdfff) || point === 0xfffe || point === 0xffff) {
        throw studioError_('invalid_fields');
      }
    }
    if (key !== 'brief' && /[\n\t]/.test(value)) throw studioError_('invalid_fields');
    request[key] = value;
  }
  if (!request.name || !request.contact || !request.brief) throw studioError_('invalid_fields');
  if (!['', 'تیزر تبلیغاتی', 'فیلم کوتاه یا بلند', 'محتوای فرهنگی', 'موشن گرافیک', 'پروژه دیگر'].includes(request.type) ||
      !['', 'کمتر از یک ماه', 'یک تا سه ماه', 'بیشتر از سه ماه'].includes(request.timeline)) throw studioError_('invalid_fields');
  return request;
}

function studioHash_(request) {
  const fields = ['name', 'contact', 'type', 'timeline', 'brief'].map(key => request[key]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(fields), Utilities.Charset.UTF_8)
    .map(value => (value & 255).toString(16).padStart(2, '0')).join('');
}

function studioUsage_(properties) {
  let usage;
  try { usage = JSON.parse(properties.getProperty('DAILY_USAGE') || '{}'); } catch (_) { usage = {}; }
  return Number.isFinite(usage.windowStarted) && Date.now() - usage.windowStarted < 86400000 ? usage :
    { windowStarted: Date.now(), files: 0, mail: 0 };
}

function saveStudioUsage_(properties, usage) {
  properties.setProperty('DAILY_USAGE', JSON.stringify(usage));
}

function pruneStudioJournal_(properties) {
  const cutoff = Date.now() - STUDIO_.journalDays * 86400000;
  const records = properties.getProperties();
  for (const key of Object.keys(records)) {
    if (!key.startsWith('REQ_')) continue;
    try {
      if (JSON.parse(records[key]).createdAt < cutoff) properties.deleteProperty(key);
    } catch (_) { properties.deleteProperty(key); }
  }
}

function studioExistingFile_(folderId, requestId) {
  const result = Drive.Files.list({
    q: "'" + folderId + "' in parents and trashed = false and appProperties has { key='requestId' and value='" + requestId + "' }",
    fields: 'files(id,name,appProperties)', pageSize: 2, spaces: 'drive'
  });
  if ((result.files || []).length > 1) throw studioError_('duplicate_archive');
  return (result.files || [])[0] || null;
}

function studioUpdateState_(fileId, appProperties, changes) {
  const updated = Object.assign({}, appProperties, changes);
  Drive.Files.update({ appProperties: updated }, fileId, null, { fields: 'id,appProperties' });
  return updated;
}

function persistAndSendStudioRequest_(request) {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty('FOLDER_ID');
  if (!folderId || !/^[A-Za-z0-9_-]+$/.test(folderId)) throw studioError_('not_configured');
  const hash = studioHash_(request);
  const key = 'REQ_' + request.requestId;
  let journal;
  try { journal = JSON.parse(properties.getProperty(key) || 'null'); } catch (_) { journal = null; }
  let file = studioExistingFile_(folderId, request.requestId);
  if ((journal && journal.hash !== hash) || (file && file.appProperties?.payloadHash !== hash)) {
    throw studioError_('request_conflict');
  }
  // A reserved Drive ID survives an upload timeout, so retries cannot create a second file.
  if (!file && journal) {
    try { file = Drive.Files.get(journal.fileId, { fields: 'id,name,trashed,appProperties' }); }
    catch (_) { /* A previous upload may not have reached Drive. Reuse the reserved ID below. */ }
    if (file?.trashed) throw studioError_('archive_unavailable');
    if (file && file.appProperties?.payloadHash !== hash) throw studioError_('request_conflict');
  }
  const usage = studioUsage_(properties);
  if (!file && !journal) {
    if (usage.files >= STUDIO_.dailyFiles) throw studioError_('daily_limit');
    const generated = Drive.Files.generateIds({ count: 1, space: 'drive', type: 'files' });
    if (!generated.ids?.[0]) throw studioError_('service_error');
    pruneStudioJournal_(properties);
    journal = { fileId: generated.ids[0], hash: hash, submittedAt: new Date().toISOString(), createdAt: Date.now() };
    properties.setProperty(key, JSON.stringify(journal));
    usage.files++;
    saveStudioUsage_(properties, usage);
  }
  let archive = file?.appProperties;
  if (archive?.mailStatus === 'sent') return { status: 'sent' };
  if (file) return trySendStudioArchive_(file, archive, properties, usage);
  const submittedAt = journal.submittedAt;
  const document = createRequestDocument_(request, { requestId: request.requestId, submittedAt: submittedAt });
  const blob = Utilities.newBlob(Array.from(document.bytes, byte => byte > 127 ? byte - 256 : byte), STUDIO_.docxMime, document.filename);
  if (!file) {
    archive = { requestId: request.requestId, payloadHash: hash, submittedAt: submittedAt, mailStatus: 'pending', attempts: '0', nextAttempt: '0' };
    file = Drive.Files.create({ id: journal.fileId, name: document.filename, mimeType: STUDIO_.docxMime,
      parents: [folderId], appProperties: archive }, blob, { fields: 'id,name,appProperties' });
  }
  return trySendStudioArchive_(file, archive, properties, usage);
}

function retryStudioArchive_(fileId, archive) {
  const attempts = Math.min(Number(archive.attempts || 0) + 1, 30);
  const wait = Math.min(86400000, 1800000 * Math.pow(2, Math.min(attempts - 1, 6)));
  try {
    studioUpdateState_(fileId, archive, { mailStatus: 'retry', attempts: String(attempts), nextAttempt: String(Date.now() + wait) });
  } catch (_) { /* Existing pending/sending metadata remains available to the next worker. */ }
}

function trySendStudioArchive_(file, archive, properties, usage) {
  if (archive.mailStatus === 'sent') return { status: 'sent' };
  if (Number(archive.nextAttempt || 0) > Date.now()) return { status: 'saved', code: 'email_pending' };
  let quota;
  try { quota = MailApp.getRemainingDailyQuota(); }
  catch (_) { return { status: 'saved', code: 'email_pending' }; }
  if (usage.mail >= STUDIO_.dailyMail || quota < 1) return { status: 'saved', code: 'email_quota' };
  let blob;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(file.id)) throw new Error('Invalid archive ID');
    const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) throw new Error('Archive download unavailable');
    blob = response.getBlob().setName(file.name).setContentType(STUDIO_.docxMime);
    const bytes = blob.getBytes();
    if (bytes.length < 4 || bytes.length > 5000000 || (bytes[0] & 255) !== 80 || (bytes[1] & 255) !== 75) {
      throw new Error('Archive document invalid');
    }
    // Mark before sending; a stalled attempt is retried by the next scheduled worker.
    // MailApp has no idempotency key, so a provider timeout can cause a duplicate email with this same request ID.
    archive = studioUpdateState_(file.id, archive, { mailStatus: 'sending', nextAttempt: String(Date.now() + 1800000) });
  } catch (_) {
    retryStudioArchive_(file.id, archive);
    return { status: 'saved', code: 'email_pending' };
  }
  usage.mail++;
  saveStudioUsage_(properties, usage);
  const body = [
    'درخواست همکاری جدید از وب‌سایت استودیوی بی‌نهایت',
    'شماره درخواست: ' + archive.requestId,
    'زمان ثبت (UTC): ' + archive.submittedAt,
    'تمام اطلاعات ثبت‌شده متقاضی در فایل Word پیوست است.', '',
    'فایل Word این درخواست پیش از ارسال ایمیل در پوشه خصوصی Google Drive ذخیره شده است.',
    'نسخه بایگانی: https://drive.google.com/file/d/' + file.id + '/view'
  ].join('\n');
  try {
    MailApp.sendEmail({
      to: STUDIO_.recipient,
      subject: 'درخواست همکاری جدید | بی‌نهایت | ' + archive.requestId.slice(0, 8),
      body: body, name: 'استودیوی بی‌نهایت', attachments: [blob]
    });
  } catch (_) {
    retryStudioArchive_(file.id, archive);
    return { status: 'saved', code: 'email_pending' };
  }
  try { studioUpdateState_(file.id, archive, { mailStatus: 'sent', nextAttempt: '0' }); }
  catch (_) { /* The queue is at-least-once; a successful mail followed by a metadata failure can be sent again. */ }
  return { status: 'sent' };
}

function processPendingRequests() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const counts = { checked: 0, sent: 0, pending: 0 };
  try {
    const properties = PropertiesService.getScriptProperties();
    const folderId = properties.getProperty('FOLDER_ID');
    if (!folderId || !/^[A-Za-z0-9_-]+$/.test(folderId)) return;
    const usage = studioUsage_(properties);
    if (usage.mail >= STUDIO_.dailyMail || MailApp.getRemainingDailyQuota() < 1) return;
    const states = ['pending', 'retry', 'sending'].map(state => "appProperties has { key='mailStatus' and value='" + state + "' }").join(' or ');
    let pageToken;
    const deadline = Date.now() + 240000;
    do {
      const options = {
        q: "'" + folderId + "' in parents and trashed = false and (" + states + ")",
        fields: 'nextPageToken,files(id,name,appProperties)', pageSize: 100, orderBy: 'createdTime', spaces: 'drive'
      };
      if (pageToken) options.pageToken = pageToken;
      const page = Drive.Files.list(options);
      for (const file of page.files || []) {
        if (Date.now() >= deadline || usage.mail >= STUDIO_.dailyMail || MailApp.getRemainingDailyQuota() < 1) break;
        const archive = file.appProperties || {};
        if (!/^[a-f0-9-]{36}$/.test(archive.requestId || '') || !/^[a-f0-9]{64}$/.test(archive.payloadHash || '')) continue;
        counts.checked++;
        const result = trySendStudioArchive_(file, archive, properties, usage);
        if (result.status === 'sent') counts.sent++; else counts.pending++;
      }
      pageToken = page.nextPageToken;
    } while (pageToken && Date.now() < deadline && usage.mail < STUDIO_.dailyMail && MailApp.getRemainingDailyQuota() > 0);
    console.log('Collaboration queue: ' + JSON.stringify(counts));
    return counts;
  } finally { lock.releaseLock(); }
}

function studioResponse_(request, status, code) {
  const payload = {
    type: 'binahayat:collaboration-result',
    requestId: /^[a-f0-9-]{36}$/.test(request?.requestId || '') ? request.requestId : '',
    nonce: /^[a-f0-9]{64}$/.test(request?.nonce || '') ? request.nonce : '',
    status: status
  };
  if (code) payload.code = code;
  const encoded = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.top.postMessage(' +
    encoded + ',"' + STUDIO_.origin + '");</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
