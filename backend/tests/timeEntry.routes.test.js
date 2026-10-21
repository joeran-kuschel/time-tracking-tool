const router = require('../src/routes/timeEntries');

test('matches /active before /:id, so "active" is not read as an id', () => {
  const getPaths = router.stack
    .filter((layer) => layer.route && layer.route.methods.get)
    .map((layer) => layer.route.path);

  expect(getPaths.indexOf('/active')).toBeGreaterThanOrEqual(0);
  expect(getPaths.indexOf('/active')).toBeLessThan(getPaths.indexOf('/:id'));
});

test('matches /search before /:id, so "search" is not read as an id', () => {
  const getPaths = router.stack
    .filter((layer) => layer.route && layer.route.methods.get)
    .map((layer) => layer.route.path);

  expect(getPaths.indexOf('/search')).toBeGreaterThanOrEqual(0);
  expect(getPaths.indexOf('/search')).toBeLessThan(getPaths.indexOf('/:id'));
});

test('serves the entries of a customer', () => {
  const route = router.stack.find((layer) => layer.route?.path === '/customer/:customerId');

  expect(route.route.methods.get).toBe(true);
});
