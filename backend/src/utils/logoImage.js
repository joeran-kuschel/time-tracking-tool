const zlib = require('zlib');
const PDFDocument = require('pdfkit');

// The checks for a logo that is uploaded: a PNG or JPEG of at most 1 MB and 2000 x 2000 pixels. The type is read from the
// first bytes of the file, not from what the browser says, the picture data of a PNG must not inflate to more than its
// header says, and the image must be one that the PDF library can embed.
// SVG is refused: it can carry scripts, and the PDF library does not draw it.
const MAX_BYTES = 1024 * 1024;
const MAX_PIXELS = 2000;
// The JSON body of the upload: the image as base64 is a third larger than the file, plus the JSON around it
const BODY_LIMIT = '1.5mb';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TYPES = ['image/png', 'image/jpeg'];

const INVALID = { status: 400, code: 'LOGO_INVALID', error: 'The logo must be a valid PNG or JPEG image' };
const TOO_LARGE = { status: 400, code: 'LOGO_TOO_LARGE', error: 'The logo is larger than 1 MB' };
const TOO_BIG_IMAGE = { status: 400, code: 'LOGO_DIMENSIONS', error: `The logo is larger than ${MAX_PIXELS} x ${MAX_PIXELS} pixels` };

// 'image/png' or 'image/jpeg' by the first bytes, or null
function typeOf(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  return null;
}

// { width, height } of a PNG from its header chunk, or null
function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// The picture data of a PNG must inflate to the size that its header gives, never to more: a small file can hold
// gigabytes of zeros (a decompression bomb), and the PDF library inflates a PNG with an alpha channel in memory. The size
// is width x height x channels x depth, with one filter byte per row. Only the colour types and bit depths of the PNG
// standard count: a made-up depth would make the header's size huge, and so the limit. With at most 2000 x 2000 pixels the
// largest honest image (16 bit RGBA) is 32 MB. An interlaced image has up to two extra bytes (filter and padding) in about
// twice as many rows, so it only has to stay below the size plus 4 bytes per row. The inflating stops at the limit.
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const DEPTHS = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
function pngDataFits(buffer) {
  const header = buffer.subarray(16, 29);
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const channels = CHANNELS[header[9]];
  if (!channels || !DEPTHS[header[9]].includes(header[8]) || header[10] !== 0 || header[11] !== 0 || header[12] > 1) return false;
  const rowBytes = Math.ceil((width * channels * header[8]) / 8) + 1;
  const interlaced = header[12] === 1;
  const idat = [];
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(buffer.subarray(offset + 8, offset + 8 + length));
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  const expected = height * rowBytes;
  const limit = interlaced ? expected + 4 * height + 64 : expected;
  try {
    const raw = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: limit + 1 });
    return interlaced ? raw.length > 0 && raw.length <= limit : raw.length === expected;
  } catch {
    return false; // damaged, or more data than the header allows
  }
}

// { width, height } of a JPEG from its first start-of-frame marker, or null. Segments are walked by their length, so
// a thumbnail inside an EXIF segment is not mistaken for the image.
function jpegSize(buffer) {
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1; // fill byte
    } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2; // markers without a length
    } else if (marker === 0xd9 || marker === 0xda) {
      return null; // the end, or the image data, without a frame header
    } else {
      const length = buffer.readUInt16BE(offset + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) {
        return offset + 9 <= buffer.length ? { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) } : null;
      }
      if (length < 2) return null;
      offset += 2 + length;
    }
  }
  return null;
}

// Whether the PDF library can embed the image: it draws it into a throwaway document, which reads and decodes the whole
// picture (a file with a good header and no picture data fails here, not later in a report)
function embeddable(buffer) {
  return new Promise((resolve) => {
    try {
      const doc = new PDFDocument();
      doc.on('data', () => {});
      doc.on('end', () => resolve(true));
      doc.on('error', () => resolve(false));
      doc.image(buffer, 0, 0, { width: 10 });
      doc.end();
    } catch {
      resolve(false);
    }
  });
}

// Checks an upload { contentType, data } (data is base64) and resolves to { ok: true, contentType, data (a Buffer) }, or
// { ok: false, status, code, error } with the reason: LOGO_INVALID, LOGO_TOO_LARGE or LOGO_DIMENSIONS
async function checkLogo(upload) {
  const { contentType, data } = upload ?? {};
  if (!TYPES.includes(contentType)) return { ok: false, ...INVALID };
  if (typeof data !== 'string' || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { ok: false, ...INVALID };
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > MAX_BYTES) return { ok: false, ...TOO_LARGE };
  const detected = typeOf(buffer);
  if (detected !== contentType) return { ok: false, ...INVALID };
  const size = detected === 'image/png' ? pngSize(buffer) : jpegSize(buffer);
  if (!size || size.width < 1 || size.height < 1) return { ok: false, ...INVALID };
  if (size.width > MAX_PIXELS || size.height > MAX_PIXELS) return { ok: false, ...TOO_BIG_IMAGE };
  if (detected === 'image/png' && !pngDataFits(buffer)) return { ok: false, ...INVALID };
  if (!(await embeddable(buffer))) return { ok: false, ...INVALID };
  return { ok: true, contentType: detected, data: buffer };
}

module.exports = { checkLogo, BODY_LIMIT, MAX_BYTES, MAX_PIXELS };
