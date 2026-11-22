const zlib = require('zlib');

// Small real images for the logo tests: a PNG built by hand (grayscale, 8 bit, one filter byte per row) and the smallest
// JPEG there is (1 x 1), whose size can be changed in its frame header.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data = Buffer.alloc(0)) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

// A valid PNG of the given size. The header is what the size checks read, so a huge size costs nothing:
// pass `data: false` to leave out the pixel data (the file is then not embeddable, but its header is right)
function png(width = 4, height = 2, { data = true, colorType = 0, interlace = 0, raw = null, depth = 8 } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = depth; // bit depth
  header[9] = colorType; // 0 grayscale, 2 RGB, 3 palette, 4 grayscale + alpha, 6 RGBA
  header[12] = interlace;
  // `raw`: the number of bytes the picture data inflates to; by default what the header says (8 bit samples)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const rows = data ? zlib.deflateSync(Buffer.alloc(raw ?? (width * channels + 1) * height)) : Buffer.alloc(0);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), ...(data ? [chunk('IDAT', rows)] : []), chunk('IEND'),
  ]);
}

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

// The tiny JPEG with another size in its frame header (the start-of-frame marker FF C0 or FF C2)
function jpeg(width = 1, height = 1) {
  const copy = Buffer.from(TINY_JPEG);
  const at = copy.indexOf(Buffer.from([0xff, 0xc0]));
  const frame = at !== -1 ? at : copy.indexOf(Buffer.from([0xff, 0xc2]));
  copy.writeUInt16BE(height, frame + 5);
  copy.writeUInt16BE(width, frame + 7);
  return copy;
}

const upload = (contentType, buffer) => ({ contentType, data: buffer.toString('base64') });

module.exports = { png, jpeg, upload, TINY_JPEG };
