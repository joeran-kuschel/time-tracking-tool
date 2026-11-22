jest.mock('../src/models/Invoice');
jest.mock('../src/models/InvoiceCounter');
jest.mock('../src/models/Customer');
jest.mock('../src/models/TimeEntry');
jest.mock('../src/models/Settings');
jest.mock('../src/models/Logo');
jest.mock('../src/utils/invoicePdf');

const Invoice = require('../src/models/Invoice');
const InvoiceCounter = require('../src/models/InvoiceCounter');
const Customer = require('../src/models/Customer');
const TimeEntry = require('../src/models/TimeEntry');
const Settings = require('../src/models/Settings');
const Logo = require('../src/models/Logo');
const { generateInvoicePDF } = require('../src/utils/invoicePdf');
const controller = require('../src/controllers/invoiceController');
const router = require('../src/routes/invoices');

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.end = jest.fn(() => res);
  res.contentType = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  return res;
}

async function call(handler, req) {
  const res = mockResponse();
  await handler(req, res);
  return res;
}

const SETTINGS = {
  senderName: 'Jana Beispiel', senderAddress: 'Weg 5\n54321 Stadt', senderEmail: 'jana@example.test', senderTaxId: '12/345/67890', senderBankDetails: 'DE89 3704',
  vatMode: 'regular', vatRate: 19, invoiceNumberPattern: '{YYYY}-{NNNN}', roundingMinutes: 0, roundingDirection: 'up',
};
const CUSTOMER = { id: 3, name: 'Muster GmbH', address: 'Musterweg 1\n12345 Musterstadt', tax_id: 'DE999', report_language: null };
const entry = (project, projectId, minutes, rate) => ({
  project_id: projectId, project_name: project, hourly_rate: rate, start_time: '2026-02-02T08:00:00Z',
  end_time: new Date(Date.parse('2026-02-02T08:00:00Z') + minutes * 60000).toISOString(),
});
const ENTRIES = [entry('Website', 1, 750, '80.00'), entry('Beratung', 2, 90, '95.00')];
const BODY = { customerId: 3, from: '2026-02-01', to: '2026-02-28', tz: 'Europe/Berlin', invoiceDate: '2026-03-05' };
const ROW = {
  id: 7, number: '2026-0001', customer_id: 3, customer_name: 'Muster GmbH', invoice_date: '2026-03-05', period_from: '2026-02-01', period_to: '2026-02-28',
  language: 'de', vat_mode: 'regular', vat_rate: 19, net_cents: 114250, vat_cents: 21708, gross_cents: 135958, created_at: '2026-03-05T10:00:00.000Z',
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  Customer.getById.mockResolvedValue(CUSTOMER);
  Settings.get.mockResolvedValue(SETTINGS);
  TimeEntry.getByCustomerIdInRange.mockResolvedValue(ENTRIES);
  InvoiceCounter.next.mockResolvedValue(7);
  Logo.get.mockResolvedValue(null);
  generateInvoicePDF.mockResolvedValue(Buffer.from('%PDF'));
  Invoice.create.mockImplementation(async (data, render) => {
    await render('2026-0001');
    return ROW;
  });
});

afterEach(() => console.error.mockRestore());

test('the routes: preview, create, list, the PDF and delete', () => {
  const routes = router.stack.map((layer) => [Object.keys(layer.route.methods)[0], layer.route.path]);

  expect(routes).toEqual([['post', '/preview'], ['post', '/'], ['get', '/'], ['get', '/:id/pdf'], ['delete', '/:id']]);
});

describe('preview', () => {
  test('answers with the lines, the totals, the number it would get and what is missing (nothing here)', async () => {
    const res = await call(controller.preview, { body: BODY });

    expect(res.json).toHaveBeenCalledWith({
      customer: { id: 3, name: 'Muster GmbH' },
      from: '2026-02-01', to: '2026-02-28', invoiceDate: '2026-03-05', language: 'de', number: '2026-0007',
      lines: [
        { projectId: 2, name: 'Beratung', minutes: 90, hours: '1.50', hourlyRate: '95.00', amount: '142.50' },
        { projectId: 1, name: 'Website', minutes: 750, hours: '12.50', hourlyRate: '80.00', amount: '1000.00' },
      ],
      currency: 'EUR', vatMode: 'regular', vatRate: 19, net: '1142.50', vat: '217.08', gross: '1359.58', missing: [],
    });
  });

  test('asks the entries of the days in the time zone, and for the counter of the year of the invoice date', async () => {
    await call(controller.preview, { body: BODY });

    expect(TimeEntry.getByCustomerIdInRange).toHaveBeenCalledWith(3, { from: '2026-01-31T23:00:00.000Z', to: '2026-02-28T23:00:00.000Z' });
    expect(InvoiceCounter.next).toHaveBeenCalledWith(2026);
  });

  test('takes no number and stores nothing', async () => {
    await call(controller.preview, { body: BODY });

    expect(Invoice.create).not.toHaveBeenCalled();
    expect(generateInvoicePDF).not.toHaveBeenCalled();
  });

  test('names what is missing', async () => {
    Settings.get.mockResolvedValue({ ...SETTINGS, senderName: null, senderTaxId: null });
    Customer.getById.mockResolvedValue({ ...CUSTOMER, address: null });
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([]);

    const res = await call(controller.preview, { body: BODY });

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ lines: [], net: '0.00', missing: ['senderName', 'senderTaxId', 'customerAddress', 'noEntries'] }));
  });

  test('the number follows the pattern, the counter and the date', async () => {
    Settings.get.mockResolvedValue({ ...SETTINGS, invoiceNumberPattern: 'RE-{YY}{MM}-{NN}' });

    const res = await call(controller.preview, { body: BODY });

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ number: 'RE-2603-07' }));
    expect(InvoiceCounter.next).toHaveBeenCalledWith(2026);
  });

  test('a pattern without a year uses the counter 0', async () => {
    Settings.get.mockResolvedValue({ ...SETTINGS, invoiceNumberPattern: 'RE-{NNNN}' });

    await call(controller.preview, { body: BODY });

    expect(InvoiceCounter.next).toHaveBeenCalledWith(0);
  });

  test('a small business shows no VAT and a gross equal to the net', async () => {
    Settings.get.mockResolvedValue({ ...SETTINGS, vatMode: 'small_business' });

    const res = await call(controller.preview, { body: BODY });

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ vatMode: 'small_business', net: '1142.50', vat: '0.00', gross: '1142.50' }));
  });

  test("the language is the customer's report language, else the one asked for, else German", async () => {
    Customer.getById.mockResolvedValue({ ...CUSTOMER, report_language: 'en' });
    expect((await call(controller.preview, { body: { ...BODY, lang: 'de' } })).json).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));

    Customer.getById.mockResolvedValue(CUSTOMER);
    expect((await call(controller.preview, { body: { ...BODY, lang: 'en' } })).json).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
    expect((await call(controller.preview, { body: BODY })).json).toHaveBeenCalledWith(expect.objectContaining({ language: 'de' }));
  });

  test("uses the customer's own rounding rule, like the report", async () => {
    Customer.getById.mockResolvedValue({ ...CUSTOMER, rounding_minutes: 60, rounding_direction: 'up' });
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([
      { ...entry('Website', 1, 65, '80.00'), customer_rounding_minutes: 60, customer_rounding_direction: 'up' },
    ]);

    const res = await call(controller.preview, { body: BODY });

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ lines: [expect.objectContaining({ minutes: 120, amount: '160.00' })] }));
  });

  test.each([
    [{ customerId: undefined }, 'customerId is required'],
    [{ from: '2026-02-30' }, 'from and to are required as YYYY-MM-DD'],
    [{ from: '2026-03-01', to: '2026-02-01' }, 'from must not be after to'],
    [{ invoiceDate: 'today' }, 'invoiceDate must be YYYY-MM-DD'],
  ])('answers 400 for %j', async (change, message) => {
    const res = await call(controller.preview, { body: { ...BODY, ...change } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: message });
    expect(Customer.getById).not.toHaveBeenCalled();
  });

  test('answers 404 for a customer that does not exist', async () => {
    Customer.getById.mockResolvedValue(undefined);

    const res = await call(controller.preview, { body: BODY });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Customer not found' });
  });

  test('answers 500 when the database fails', async () => {
    Settings.get.mockRejectedValue(new Error('down'));

    const res = await call(controller.preview, { body: BODY });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to prepare the invoice' });
  });
});

describe('create', () => {
  test('stores the invoice with a copy of the details, and answers 201 with its summary', async () => {
    const res = await call(controller.create, { body: BODY });

    expect(Invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      pattern: '{YYYY}-{NNNN}', customerId: 3, invoiceDate: '2026-03-05', periodFrom: '2026-02-01', periodTo: '2026-02-28', language: 'de',
      customer: { name: 'Muster GmbH', address: 'Musterweg 1\n12345 Musterstadt', taxId: 'DE999' },
      sender: { name: 'Jana Beispiel', address: 'Weg 5\n54321 Stadt', email: 'jana@example.test', taxId: '12/345/67890', bankDetails: 'DE89 3704' },
      vatMode: 'regular', vatRate: 19, netCents: 114250, vatCents: 21708, grossCents: 135958,
      lines: [expect.objectContaining({ name: 'Beratung', minutes: 90, cents: 14250 }), expect.objectContaining({ name: 'Website', minutes: 750, cents: 100000 })],
    }), expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 7, number: '2026-0001', customerId: 3, customerName: 'Muster GmbH', invoiceDate: '2026-03-05', periodFrom: '2026-02-01', periodTo: '2026-02-28',
      language: 'de', vatMode: 'regular', vatRate: 19, currency: 'EUR', net: '1142.50', vat: '217.08', gross: '1359.58', createdAt: '2026-03-05T10:00:00.000Z',
    });
  });

  test('makes the PDF with the number the model took, in the language of the invoice, with your logo', async () => {
    const logo = Buffer.from('png');
    Logo.get.mockResolvedValue({ contentType: 'image/png', data: logo });
    Customer.getById.mockResolvedValue({ ...CUSTOMER, report_language: 'en' });

    await call(controller.create, { body: BODY });

    expect(generateInvoicePDF).toHaveBeenCalledWith(
      expect.objectContaining({
        number: '2026-0001', invoiceDate: '2026-03-05', periodFrom: '2026-02-01', periodTo: '2026-02-28',
        sender: expect.objectContaining({ name: 'Jana Beispiel', taxId: '12/345/67890', bankDetails: 'DE89 3704', logo }),
        customer: expect.objectContaining({ name: 'Muster GmbH' }),
        lines: expect.any(Array),
      }),
      { locale: 'en' }
    );
  });

  test('the PDF has no logo when there is none', async () => {
    await call(controller.create, { body: BODY });

    expect(generateInvoicePDF.mock.calls[0][0].sender.logo).toBeNull();
  });

  test('the stored copy does not carry the logo (it is in the PDF only)', async () => {
    await call(controller.create, { body: BODY });

    expect(Invoice.create.mock.calls[0][0].sender).not.toHaveProperty('logo');
  });

  test.each([
    ['senderName', { settings: { senderName: null } }],
    ['senderAddress', { settings: { senderAddress: null } }],
    ['senderTaxId', { settings: { senderTaxId: null } }],
    ['customerAddress', { customer: { address: null } }],
    ['noEntries', { entries: [] }],
  ])('answers 422 with the code %s when it is missing, and takes no number', async (code, change) => {
    Settings.get.mockResolvedValue({ ...SETTINGS, ...change.settings });
    Customer.getById.mockResolvedValue({ ...CUSTOMER, ...change.customer });
    if (change.entries) TimeEntry.getByCustomerIdInRange.mockResolvedValue(change.entries);

    const res = await call(controller.create, { body: BODY });

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ error: 'Details for the invoice are missing', missing: [code] });
    expect(Invoice.create).not.toHaveBeenCalled();
  });

  test('answers 400 for a bad request and 404 for an unknown customer, and stores nothing', async () => {
    const bad = await call(controller.create, { body: { ...BODY, from: 'x' } });
    Customer.getById.mockResolvedValue(undefined);
    const unknown = await call(controller.create, { body: BODY });

    expect(bad.status).toHaveBeenCalledWith(400);
    expect(unknown.status).toHaveBeenCalledWith(404);
    expect(Invoice.create).not.toHaveBeenCalled();
  });

  test('answers 404 when the customer was deleted after it was read (foreign key error), without logging an error', async () => {
    Invoice.create.mockRejectedValue(Object.assign(new Error('violates foreign key constraint'), { code: '23503' }));

    const res = await call(controller.create, { body: BODY });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Customer not found' });
    expect(console.error).not.toHaveBeenCalled();
  });

  test('answers 409 with a hint when the number is already used', async () => {
    Invoice.create.mockRejectedValue(Object.assign(new Error('The invoice number 2026-0001 is already used'), { code: 'NUMBER_TAKEN' }));

    const res = await call(controller.create, { body: BODY });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'The invoice number 2026-0001 is already used. Raise the next invoice number in the settings.', code: 'NUMBER_TAKEN' });
    expect(console.error).not.toHaveBeenCalled();
  });

  test('answers 500 when storing fails, or when the PDF cannot be made', async () => {
    Invoice.create.mockRejectedValue(new Error('down'));
    expect((await call(controller.create, { body: BODY })).status).toHaveBeenCalledWith(500);

    Invoice.create.mockImplementation(async (data, render) => render('2026-0001'));
    generateInvoicePDF.mockRejectedValue(new Error('pdf broke'));
    const res = await call(controller.create, { body: BODY });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create the invoice' });
  });
});

describe('getAll', () => {
  test('lists the invoices as summaries', async () => {
    Invoice.getAll.mockResolvedValue([ROW]);

    const res = await call(controller.getAll, {});

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ id: 7, number: '2026-0001', customerName: 'Muster GmbH', net: '1142.50', gross: '1359.58' })]);
  });

  test('a customer that was deleted shows as null', async () => {
    Invoice.getAll.mockResolvedValue([{ ...ROW, customer_id: null }]);

    const res = await call(controller.getAll, {});

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ customerId: null, customerName: 'Muster GmbH' })]);
  });

  test('answers 500 when the database fails', async () => {
    Invoice.getAll.mockRejectedValue(new Error('down'));

    const res = await call(controller.getAll, {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch invoices' });
  });
});

describe('getPdf', () => {
  test('sends the stored file as an attachment, with the number in its name', async () => {
    const pdf = Buffer.from('%PDF-stored');
    Invoice.getPdf.mockResolvedValue({ number: '2026-0001', pdf });

    const res = await call(controller.getPdf, { params: { id: '7' }, query: {} });

    expect(res.contentType).toHaveBeenCalledWith('application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=invoice-2026-0001.pdf');
    expect(res.send).toHaveBeenCalledWith(pdf);
  });

  test('opens in the browser with inline=1', async () => {
    Invoice.getPdf.mockResolvedValue({ number: '2026-0001', pdf: Buffer.from('x') });

    const res = await call(controller.getPdf, { params: { id: '7' }, query: { inline: '1' } });

    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename=invoice-2026-0001.pdf');
  });

  test('a number with a slash makes a safe file name', async () => {
    Invoice.getPdf.mockResolvedValue({ number: 'RE/2026/03', pdf: Buffer.from('x') });

    const res = await call(controller.getPdf, { params: { id: '7' }, query: {} });

    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=invoice-RE_2026_03.pdf');
  });

  test('does not make a new PDF: it is the stored one', async () => {
    Invoice.getPdf.mockResolvedValue({ number: '2026-0001', pdf: Buffer.from('x') });

    await call(controller.getPdf, { params: { id: '7' }, query: {} });

    expect(generateInvoicePDF).not.toHaveBeenCalled();
  });

  test.each([['99'], ['0'], ['abc'], ['1.5'], ['-1'], ['99999999999']])('answers 404 for %j, without asking the database for bad ids', async (id) => {
    Invoice.getPdf.mockResolvedValue(undefined);

    const res = await call(controller.getPdf, { params: { id }, query: {} });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invoice not found' });
    expect(res.send).not.toHaveBeenCalled();
  });

  test('answers 500 when the database fails', async () => {
    Invoice.getPdf.mockRejectedValue(new Error('down'));

    const res = await call(controller.getPdf, { params: { id: '7' }, query: {} });

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('delete', () => {
  test('deletes and answers 204 without a body', async () => {
    Invoice.delete.mockResolvedValue('2026-0001');

    const res = await call(controller.delete, { params: { id: '7' } });

    expect(Invoice.delete).toHaveBeenCalledWith('7');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  test('does not move the counter back', async () => {
    Invoice.delete.mockResolvedValue('2026-0001');

    await call(controller.delete, { params: { id: '7' } });

    expect(InvoiceCounter.raise).not.toHaveBeenCalled();
    expect(InvoiceCounter.take).not.toHaveBeenCalled();
  });

  test.each([['abc'], ['0'], ['-3'], ['1; DROP TABLE invoices']])('answers 404 for the bad id %j without asking the database', async (id) => {
    const res = await call(controller.delete, { params: { id } });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Invoice.delete).not.toHaveBeenCalled();
  });

  test('answers 404 for an invoice that does not exist', async () => {
    Invoice.delete.mockResolvedValue(undefined);

    const res = await call(controller.delete, { params: { id: '99' } });

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('answers 500 when the database fails', async () => {
    Invoice.delete.mockRejectedValue(new Error('down'));

    const res = await call(controller.delete, { params: { id: '7' } });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete the invoice' });
  });
});

describe('ids that are digits but too big for the database', () => {
  // The id is an integer column that ends at 2147483647: a larger one is a 404 like any other id that does not exist, and
  // never reaches the database (which would answer "out of range", 22003, and become a 500)
  test.each([['getPdf'], ['delete']])('%s answers 404 for 9999999999 without asking the database', async (name) => {
    Invoice.getPdf.mockRejectedValue(Object.assign(new Error('value out of range for type integer'), { code: '22003' }));
    Invoice.delete.mockRejectedValue(Object.assign(new Error('value out of range for type integer'), { code: '22003' }));

    const res = await call(controller[name], { params: { id: '9999999999' }, query: {} });

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('2147483647 still goes to the database', async () => {
    Invoice.getPdf.mockResolvedValue(undefined);

    const res = await call(controller.getPdf, { params: { id: '2147483647' }, query: {} });

    expect(Invoice.getPdf).toHaveBeenCalledWith('2147483647');
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
