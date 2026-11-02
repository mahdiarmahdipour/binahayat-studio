/* Server-generated macro-free Word document. No visitor-provided binary file is accepted. */
var StudioWord_ = (() => {
  'use strict';
  const encode = value => Uint8Array.from(Utilities.newBlob(String(value)).getBytes(), byte => byte & 255);
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  function cleanText(value) {
    // XML 1.0 accepts these ranges only. Iterating code points also removes lone surrogates.
    return Array.from(String(value ?? '')).filter(character => {
      const point = character.codePointAt(0);
      return point === 9 || point === 10 || point === 13 ||
        (point >= 0x20 && point <= 0xd7ff) ||
        (point >= 0xe000 && point <= 0xfffd) ||
        (point >= 0x10000 && point <= 0x10ffff);
    }).join('').replace(/\r\n?/g, '\n');
  }

  function escapeXml(value) {
    return cleanText(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[character]);
  }

  function trackingId() { return Utilities.getUuid(); }

  function run(text, { bold = false, ltr = false } = {}) {
    return `<w:r><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:color w:val="000000"/><w:rtl w:val="${ltr ? '0' : '1'}"/><w:lang w:val="fa-IR" w:bidi="fa-IR"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  }

  function paragraph(text, { style = 'Normal', bold = false, ltr = false, keepNext = false } = {}) {
    return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${keepNext ? '<w:keepNext/>' : ''}<w:widowControl/><w:bidi/><w:jc w:val="right"/></w:pPr>${run(text, { bold, ltr })}</w:p>`;
  }

  function field(label, value, options = {}) {
    const text = cleanText(value);
    const display = text.trim() ? text : 'مشخص نشده';
    return paragraph(label, { style: 'FieldLabel', bold: true, keepNext: true }) +
      display.split('\n').map(line => paragraph(line, options)).join('');
  }

  const stylesXml = xmlHeader + `<w:styles xmlns:w="${wordNamespace}">
    <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:rtl/><w:lang w:val="fa-IR" w:bidi="fa-IR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:widowControl/><w:bidi/><w:spacing w:after="100" w:line="336" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr></w:pPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:bidi/><w:spacing w:after="100" w:line="336" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr><w:rPr><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:bidi/><w:spacing w:before="0" w:after="260"/><w:jc w:val="right"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="FieldLabel"><w:name w:val="Field Label"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:bidi/><w:spacing w:before="180" w:after="55"/><w:jc w:val="right"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  </w:styles>`;

  const crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    crcTable[index] = value >>> 0;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concat(parts) {
    const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }

  function zipStored(entries, date) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const year = Math.max(1980, Math.min(2107, date.getUTCFullYear()));
    const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
    const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
    for (const [filename, contents] of entries) {
      const name = encode(filename);
      const bytes = encode(contents);
      const checksum = crc32(bytes);
      const local = new Uint8Array(30 + name.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(10, dosTime, true);
      localView.setUint16(12, dosDate, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, bytes.length, true);
      localView.setUint32(22, bytes.length, true);
      localView.setUint16(26, name.length, true);
      local.set(name, 30);
      localParts.push(local, bytes);

      const central = new Uint8Array(46 + name.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(12, dosTime, true);
      centralView.setUint16(14, dosDate, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, bytes.length, true);
      centralView.setUint32(24, bytes.length, true);
      centralView.setUint16(28, name.length, true);
      centralView.setUint32(42, offset, true);
      central.set(name, 46);
      centralParts.push(central);
      offset += local.length + bytes.length;
    }
    const centralDirectory = concat(centralParts);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralDirectory.length, true);
    endView.setUint32(16, offset, true);
    return concat([...localParts, centralDirectory, end]);
  }

  function createRequestDocument(fields = {}, options = {}) {
    const created = options.submittedAt === undefined ? new Date() : new Date(options.submittedAt);
    if (!Number.isFinite(created.getTime())) throw new TypeError('Invalid submission date');
    const submittedAt = created.toISOString();
    const requestId = options.requestId === undefined ? trackingId() : cleanText(options.requestId);
    if (!requestId.trim()) throw new TypeError('Request ID must not be empty');
    const displayDate = Utilities.formatDate(created, 'Asia/Tehran', 'yyyy/MM/dd HH:mm');
    const title = 'درخواست همکاری با استودیوی بی‌نهایت';
    const documentXml = xmlHeader + `<w:document xmlns:w="${wordNamespace}"><w:body>` +
      paragraph(title, { style: 'Title' }) +
      paragraph('این سند شامل اطلاعات ثبت‌شده متقاضی در فرم همکاری استودیوی بی‌نهایت است و برای بررسی اولیه پروژه و پیگیری با متقاضی تهیه شده است.') +
      field('شماره درخواست', requestId, { ltr: true }) +
      field('زمان ثبت فرم به وقت تهران', displayDate) +
      field('نام و نام خانوادگی', fields.name) +
      field('راه ارتباطی', fields.contact, { ltr: /^[\x20-\x7e]+$/.test(String(fields.contact ?? '')) }) +
      field('نوع پروژه', fields.type) +
      field('بازه زمانی', fields.timeline) +
      field('شرح ایده و درخواست', fields.brief) +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>';
    const relationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const entries = [
      ['[Content_Types].xml', xmlHeader + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
      ['_rels/.rels', xmlHeader + `<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
      ['word/document.xml', documentXml],
      ['word/styles.xml', stylesXml],
      ['word/_rels/document.xml.rels', xmlHeader + `<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['docProps/core.xml', xmlHeader + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>استودیوی بی‌نهایت</dc:creator><dc:identifier>${escapeXml(requestId)}</dc:identifier><dcterms:created xsi:type="dcterms:W3CDTF">${submittedAt}</dcterms:created></cp:coreProperties>`]
    ];
    const stamp = submittedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const suffix = requestId.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'request';
    return { bytes: zipStored(entries, created), filename: `binahayat-request-${stamp}-${suffix}.docx`, requestId, submittedAt };
  }

  return Object.freeze({ createRequestDocument });
})();

function createRequestDocument_(fields, options) {
  return StudioWord_.createRequestDocument(fields, options);
}
