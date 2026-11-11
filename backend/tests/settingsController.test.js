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
