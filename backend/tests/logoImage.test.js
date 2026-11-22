const zlib = require('zlib');
const { checkLogo, BODY_LIMIT, MAX_BYTES, MAX_PIXELS } = require('../src/utils/logoImage');
const { png, jpeg, upload, TINY_JPEG } = require('./helpers/images');

const check = (contentType, buffer) => checkLogo(upload(contentType, buffer));
const refused = (code) => expect.objectContaining({ ok: false, status: 400, code });

describe('checkLogo', () => {
  test('accepts a PNG and a JPEG and returns the bytes', async () => {
    const image = png(40, 20);

    expect(await check('image/png', image)).toEqual({ ok: true, contentType: 'image/png', data: image });
    expect(await check('image/jpeg', TINY_JPEG)).toEqual({ ok: true, contentType: 'image/jpeg', data: TINY_JPEG });
  });

  test('accepts the largest size: 2000 x 2000 pixels', async () => {
    expect((await check('image/png', png(MAX_PIXELS, MAX_PIXELS))).ok).toBe(true);
    expect((await check('image/jpeg', jpeg(MAX_PIXELS, MAX_PIXELS))).ok).toBe(true);
  });

  test.each([[MAX_PIXELS + 1, 10], [10, MAX_PIXELS + 1], [65535, 65535]])('refuses %i x %i pixels with LOGO_DIMENSIONS', async (width, height) => {
    expect(await check('image/png', png(width, height, { data: false }))).toEqual(refused('LOGO_DIMENSIONS'));
    expect(await check('image/jpeg', jpeg(width, height))).toEqual(refused('LOGO_DIMENSIONS'));
  });

  test('refuses a size of 0', async () => {
    expect(await check('image/png', png(0, 5, { data: false }))).toEqual(refused('LOGO_INVALID'));
    expect(await check('image/jpeg', jpeg(0, 5))).toEqual(refused('LOGO_INVALID'));
  });

  test('accepts exactly 1 MB and refuses one byte more with LOGO_TOO_LARGE', async () => {
    const exact = Buffer.concat([png(4, 2), Buffer.alloc(MAX_BYTES - png(4, 2).length)]);
    const over = Buffer.concat([exact, Buffer.alloc(1)]);

    expect(exact.length).toBe(MAX_BYTES);
    expect((await check('image/png', exact)).code).not.toBe('LOGO_TOO_LARGE');
    expect(await check('image/png', over)).toEqual(refused('LOGO_TOO_LARGE'));
  });

  test('a base64 body of a 1 MB image fits into the body limit', () => {
    const base64Length = Math.ceil(MAX_BYTES / 3) * 4;

    expect(base64Length + 100).toBeLessThan(1.5 * 1024 * 1024);
    expect(BODY_LIMIT).toBe('1.5mb');
  });

  test.each([['image/svg+xml'], ['image/gif'], ['image/webp'], ['text/plain'], [''], [undefined], [null], [5], ['IMAGE/PNG']])('refuses the content type %j', async (contentType) => {
    expect(await checkLogo({ contentType, data: png().toString('base64') })).toEqual(refused('LOGO_INVALID'));
  });

  test('goes by the first bytes: a JPEG sent as a PNG, a PNG sent as a JPEG, an SVG and a text are refused', async () => {
    expect(await check('image/png', TINY_JPEG)).toEqual(refused('LOGO_INVALID'));
    expect(await check('image/jpeg', png())).toEqual(refused('LOGO_INVALID'));
    expect(await check('image/png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toEqual(refused('LOGO_INVALID'));
    expect(await check('image/jpeg', Buffer.from('not an image at all'))).toEqual(refused('LOGO_INVALID'));
  });

  test.each([[undefined], [null], [''], ['!!!!'], ['abc'], ['abcd='], ['ab=c'], ['abc d'], [5], [{}], ['data:image/png;base64,AAAA']])('refuses data that is no base64: %j', async (data) => {
    expect(await checkLogo({ contentType: 'image/png', data })).toEqual(refused('LOGO_INVALID'));
  });

  test('refuses a missing body', async () => {
    expect(await checkLogo(undefined)).toEqual(refused('LOGO_INVALID'));
    expect(await checkLogo(null)).toEqual(refused('LOGO_INVALID'));
    expect(await checkLogo({})).toEqual(refused('LOGO_INVALID'));
  });

  test('refuses a cut-off or damaged file', async () => {
    expect(await check('image/png', png(4, 2).subarray(0, 20))).toEqual(refused('LOGO_INVALID'));
    expect(await check('image/jpeg', TINY_JPEG.subarray(0, 4))).toEqual(refused('LOGO_INVALID'));
    expect(await check('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toEqual(refused('LOGO_INVALID'));
  });

  test('walks the segments of a JPEG, so a size inside another segment is not read', async () => {
    // An APP1 segment (EXIF) that contains the bytes of a frame header of 9999 x 9999 before the real frame header
    const fake = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x27, 0x0f, 0x27, 0x0f, 0x01, 0x01, 0x11, 0x00]);
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, fake.length + 2]), fake]);
    const real = jpeg(100, 50);
    const withExif = Buffer.concat([real.subarray(0, 2), app1, real.subarray(2)]);

    expect((await check('image/jpeg', withExif)).ok).toBe(true);
  });

  test('does not throw on garbage', async () => {
    for (const bytes of [[], [0xff], [0xff, 0xd8, 0xff], [0xff, 0xd8, 0xff, 0xc0], [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]) {
      const data = Buffer.from(bytes);
      expect((await check('image/jpeg', data)).ok).toBe(false);
      expect((await check('image/png', data)).ok).toBe(false);
    }
  });

  describe('a PNG whose picture data does not match its header', () => {
    test.each([[0], [2], [3], [4], [6]])('accepts a good PNG of colour type %i', async (colorType) => {
      expect((await check('image/png', png(40, 20, { colorType }))).ok).toBe(true);
    });

    test.each([[0], [6]])('refuses a decompression bomb: 64 MB of zeros behind a header of 4 x 2 pixels (colour type %i)', async (colorType) => {
      expect(await check('image/png', png(4, 2, { colorType, raw: 64 * 1024 * 1024 }))).toEqual(refused('LOGO_INVALID'));
    });

    test('refuses it before the PDF library inflates it: the check is quick and does not hold the data', async () => {
      const bomb = png(4, 2, { colorType: 6, raw: 200 * 1024 * 1024 });
      global.gc?.();
      const started = Date.now();
      const before = process.memoryUsage().rss;

      expect((await check('image/png', bomb)).ok).toBe(false);

      expect(Date.now() - started).toBeLessThan(2000);
      expect(process.memoryUsage().rss - before).toBeLessThan(150 * 1024 * 1024);
    });

    test('refuses picture data that is one byte too much or too little', async () => {
      const exact = (4 * 1 + 1) * 2;

      expect((await check('image/png', png(4, 2, { raw: exact }))).ok).toBe(true);
      expect(await check('image/png', png(4, 2, { raw: exact + 1 }))).toEqual(refused('LOGO_INVALID'));
      expect(await check('image/png', png(4, 2, { raw: exact - 1 }))).toEqual(refused('LOGO_INVALID'));
    });

    test('accepts the largest honest image: 2000 x 2000 pixels with an alpha channel', async () => {
      expect((await check('image/png', png(MAX_PIXELS, MAX_PIXELS, { colorType: 6 }))).ok).toBe(true);
    });

    test('an interlaced PNG may have more rows of filter bytes, but not a bomb', async () => {
      expect((await check('image/png', png(4, 2, { interlace: 1, raw: 12 }))).ok).toBe(true);
      expect(await check('image/png', png(4, 2, { interlace: 1, raw: 64 * 1024 * 1024 }))).toEqual(refused('LOGO_INVALID'));
    });

    // The header's size is what the limit is made of: a made-up depth must not make it huge
    test.each([[0, 3], [0, 255], [2, 4], [2, 1], [3, 16], [4, 1], [6, 4], [6, 255], [6, 0]])('refuses colour type %i with the bit depth %i, which the PNG standard does not have', async (colorType, depth) => {
      expect(await check('image/png', png(4, 2, { colorType, depth, raw: 10 }))).toEqual(refused('LOGO_INVALID'));
    });

    test('refuses the bomb of a made-up depth: 2000 x 2000 pixels, depth 255, a zero-filled picture of 495 KB when deflated', async () => {
      const bomb = png(MAX_PIXELS, MAX_PIXELS, { colorType: 6, depth: 255, raw: 510 * 1024 * 1024 });
      const started = Date.now();

      expect(bomb.length).toBeLessThan(MAX_BYTES);
      expect((await check('image/png', bomb)).ok).toBe(false);
      expect(Date.now() - started).toBeLessThan(1000);
    });

    test.each([[1, 0], [2, 3], [4, 0], [8, 6], [16, 2], [8, 4]])('accepts the bit depth %i of colour type %i', async (depth, colorType) => {
      const rowBytes = Math.ceil((40 * { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType] * depth) / 8) + 1;

      expect((await check('image/png', png(40, 20, { colorType, depth, raw: rowBytes * 20 }))).ok).toBe(true);
    });

    test('refuses an unknown interlace method', async () => {
      expect(await check('image/png', png(4, 2, { interlace: 2 }))).toEqual(refused('LOGO_INVALID'));
    });

    test('refuses a PNG without picture data, and one with an unknown colour type', async () => {
      expect(await check('image/png', png(4, 2, { data: false }))).toEqual(refused('LOGO_INVALID'));
      expect(await check('image/png', png(4, 2, { colorType: 5, raw: 10 }))).toEqual(refused('LOGO_INVALID'));
    });

    test('joins the picture data of several IDAT chunks', async () => {
      const whole = png(4, 2);
      const data = zlib.deflateSync(Buffer.alloc(10));
      const chunk = (type, body) => {
        const head = Buffer.alloc(4);
        head.writeUInt32BE(body.length);
        return Buffer.concat([head, Buffer.from(type, 'latin1'), body, Buffer.alloc(4)]);
      };
      const idat = whole.indexOf('IDAT', 0, 'latin1') - 4;
      const iend = whole.indexOf('IEND', 0, 'latin1') - 4;
      const split = Buffer.concat([whole.subarray(0, idat), chunk('IDAT', data.subarray(0, 5)), chunk('IDAT', data.subarray(5)), whole.subarray(iend)]);

      expect((await check('image/png', split)).ok).toBe(true);
    });
  });
});
