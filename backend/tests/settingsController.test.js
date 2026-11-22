jest.mock('../src/models/Settings');
jest.mock('../src/models/Logo');

const Settings = require('../src/models/Settings');
const Logo = require('../src/models/Logo');
const { png, jpeg, upload } = require('./helpers/images');
const controller = require('../src/controllers/settingsController');
const router = require('../src/routes/settings');

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('settingsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('get returns the settings', async () => {
    Settings.get.mockResolvedValue({});
    const res = mockResponse();

    await controller.get({}, res);

    expect(res.json).toHaveBeenCalledWith({});
  });

  test('get answers 500 when the database fails', async () => {
    Settings.get.mockRejectedValue(new Error('down'));
    const res = mockResponse();

    await controller.get({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load the settings' });
  });

  test('update saves and returns all settings', async () => {
    Settings.update.mockResolvedValue({});
    const res = mockResponse();

    await controller.update({ body: {} }, res);

    expect(Settings.update).toHaveBeenCalledWith({});
    expect(res.json).toHaveBeenCalledWith({});
  });

  test.each([true, false])('update saves showAmounts: %s', async (value) => {
    Settings.update.mockResolvedValue({ showAmounts: value });
    const res = mockResponse();

    await controller.update({ body: { showAmounts: value } }, res);

    expect(Settings.update).toHaveBeenCalledWith({ showAmounts: value });
    expect(res.json).toHaveBeenCalledWith({ showAmounts: value });
  });

  test.each([['yes'], ['true'], [1], [0], [null], [[]], [{}]])('update rejects %j as a value of showAmounts', async (value) => {
    const res = mockResponse();

    await controller.update({ body: { showAmounts: value } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid value for showAmounts' });
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([true, false])('update saves showRoundingNote: %s', async (value) => {
    Settings.update.mockResolvedValue({ showRoundingNote: value });
    const res = mockResponse();

    await controller.update({ body: { showRoundingNote: value } }, res);

    expect(Settings.update).toHaveBeenCalledWith({ showRoundingNote: value });
  });

  test.each([['yes'], ['true'], [1], [0], [null], [[]]])('update rejects %j as a value of showRoundingNote', async (value) => {
    const res = mockResponse();

    await controller.update({ body: { showRoundingNote: value } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid value for showRoundingNote' });
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([[0], [5], [10], [15], [30], [60]])('update saves roundingMinutes: %s', async (value) => {
    Settings.update.mockResolvedValue({});
    const res = mockResponse();

    await controller.update({ body: { roundingMinutes: value } }, res);

    expect(Settings.update).toHaveBeenCalledWith({ roundingMinutes: value });
  });

  test.each([[1], [7], [20], [45], [90], [120], [-15], ['15'], ['60'], [15.5], [null], [true], [[15]]])('update rejects %j as roundingMinutes', async (value) => {
    const res = mockResponse();

    await controller.update({ body: { roundingMinutes: value } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid value for roundingMinutes' });
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([['up'], ['nearest']])('update saves roundingDirection: %s', async (value) => {
    Settings.update.mockResolvedValue({});
    const res = mockResponse();

    await controller.update({ body: { roundingDirection: value } }, res);

    expect(Settings.update).toHaveBeenCalledWith({ roundingDirection: value });
  });

  test.each([['down'], ['UP'], [''], [1], [null]])('update rejects %j as roundingDirection', async (value) => {
    const res = mockResponse();

    await controller.update({ body: { roundingDirection: value } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid value for roundingDirection' });
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([
    [{ senderName: 'Jana Beispiel' }], [{ senderAddress: 'Musterweg 1\n12345 Beispielstadt' }], [{ senderEmail: 'jana@example.test' }],
    [{ senderName: null, senderAddress: null, senderEmail: null }],
  ])('update saves your details %j', async (body) => {
    Settings.update.mockResolvedValue({});

    await controller.update({ body }, mockResponse());

    expect(Settings.update).toHaveBeenCalledWith(body);
  });

  test.each([
    ['senderName', ''], ['senderName', ' x'], ['senderName', 'a\nb'], ['senderName', 'x'.repeat(101)],
    ['senderAddress', 'a\nb\nc\nd\ne\nf\ng'], ['senderAddress', 'x'.repeat(301)], ['senderEmail', 'not-an-email'], ['senderEmail', 5],
  ])('update rejects %s %j', async (name, value) => {
    const res = mockResponse();

    await controller.update({ body: { [name]: value } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: `Invalid value for ${name}` });
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([['monday'], ['sunday']])('update saves weekStart: %j', async (value) => {
    Settings.update.mockResolvedValue({});

    await controller.update({ body: { weekStart: value } }, mockResponse());

    expect(Settings.update).toHaveBeenCalledWith({ weekStart: value });
  });

  test.each([['saturday'], ['Monday'], [''], [null], [1]])('update rejects %j as weekStart', async (value) => {
    const res = mockResponse();

    await controller.update({ body: { weekStart: value } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid value for weekStart' });
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([[0], [80], [95.5], [null]])('update saves defaultHourlyRate: %j', async (value) => {
    Settings.update.mockResolvedValue({});
    const res = mockResponse();

    await controller.update({ body: { defaultHourlyRate: value } }, res);

    expect(Settings.update).toHaveBeenCalledWith({ defaultHourlyRate: value });
  });

  test.each([[-1], [80.555], ['80'], [''], [true], [NaN], [1e9]])('update rejects %j as defaultHourlyRate', async (value) => {
    const res = mockResponse();

    await controller.update({ body: { defaultHourlyRate: value } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid value for defaultHourlyRate' });
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test('update saves nothing when one of several values is invalid', async () => {
    const res = mockResponse();

    await controller.update({ body: { showAmounts: true, rounding: 15 } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([[[]], ['text'], [null]])('update rejects %j as the settings', async (body) => {
    const res = mockResponse();

    await controller.update({ body }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each(['rounding', '__proto__', 'constructor'])('update rejects the unknown setting %s', async (name) => {
    const res = mockResponse();

    await controller.update({ body: JSON.parse(`{"${name}": 1}`) }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: `Unknown setting: ${name}` });
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test('update answers 500 when the database fails', async () => {
    Settings.update.mockRejectedValue(new Error('down'));
    const res = mockResponse();

    await controller.update({ body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to save the settings' });
  });

  test('the routes are GET and PUT on the root, and the three of the logo', () => {
    const routes = router.stack.map((layer) => [Object.keys(layer.route.methods)[0], layer.route.path]);
    expect(routes).toEqual([['get', '/'], ['put', '/'], ['get', '/logo'], ['put', '/logo'], ['delete', '/logo']]);
  });

  describe('the logo', () => {
    function logoResponse() {
      const res = mockResponse();
      res.set = jest.fn(() => res);
      res.type = jest.fn(() => res);
      res.send = jest.fn(() => res);
      res.end = jest.fn(() => res);
      return res;
    }

    test('getLogo sends the image with its type and no caching', async () => {
      const image = png();
      Logo.get.mockResolvedValue({ contentType: 'image/png', data: image });
      const res = logoResponse();

      await controller.getLogo({}, res);

      expect(res.type).toHaveBeenCalledWith('image/png');
      expect(res.send).toHaveBeenCalledWith(image);
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    });

    test('getLogo answers 404 without a logo', async () => {
      Logo.get.mockResolvedValue(null);
      const res = logoResponse();

      await controller.getLogo({}, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).not.toHaveBeenCalled();
    });

    test('putLogo checks and stores the image, and answers with its type and size', async () => {
      const image = png(40, 20);
      const res = logoResponse();

      await controller.putLogo({ body: upload('image/png', image) }, res);

      expect(Logo.set).toHaveBeenCalledWith('image/png', image);
      expect(res.json).toHaveBeenCalledWith({ contentType: 'image/png', bytes: image.length });
    });

    test.each([
      ['not an image', { contentType: 'image/png', data: Buffer.from('hello world!').toString('base64') }, 'LOGO_INVALID'],
      ['SVG', { contentType: 'image/svg+xml', data: Buffer.from('<svg/>').toString('base64') }, 'LOGO_INVALID'],
      ['a missing body', undefined, 'LOGO_INVALID'],
      ['too many pixels', upload('image/jpeg', jpeg(3000, 10)), 'LOGO_DIMENSIONS'],
      ['more than 1 MB', upload('image/png', Buffer.concat([png(), Buffer.alloc(1024 * 1024)])), 'LOGO_TOO_LARGE'],
    ])('putLogo refuses %s with 400 and a code, and stores nothing', async (_name, body, code) => {
      const res = logoResponse();

      await controller.putLogo({ body }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.any(String), code });
      expect(Logo.set).not.toHaveBeenCalled();
    });

    test('deleteLogo removes it and answers 204', async () => {
      const res = logoResponse();

      await controller.deleteLogo({}, res);

      expect(Logo.remove).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
    });

    test.each([['getLogo', 'get', 'Failed to load the logo', {}], ['putLogo', 'set', 'Failed to save the logo', { body: upload('image/png', png()) }], ['deleteLogo', 'remove', 'Failed to remove the logo', {}]])(
      '%s answers 500 when the database fails', async (name, method, message, req) => {
        Logo[method].mockRejectedValue(new Error('db down'));
        const res = logoResponse();

        await controller[name](req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: message });
      }
    );

  });
});
