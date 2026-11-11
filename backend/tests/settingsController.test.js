jest.mock('../src/models/Settings');

const Settings = require('../src/models/Settings');
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

  test.each([[0], [15], [30]])('update saves roundingMinutes: %s', async (value) => {
    Settings.update.mockResolvedValue({});
    const res = mockResponse();

    await controller.update({ body: { roundingMinutes: value } }, res);

    expect(Settings.update).toHaveBeenCalledWith({ roundingMinutes: value });
  });

  test.each([[10], [45], [-15], ['15'], [15.5], [null], [true], [[15]]])('update rejects %j as roundingMinutes', async (value) => {
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

  test('the routes are GET and PUT on the root', () => {
    const routes = router.stack.map((layer) => [Object.keys(layer.route.methods)[0], layer.route.path]);
    expect(routes).toEqual([['get', '/'], ['put', '/']]);
  });
});
