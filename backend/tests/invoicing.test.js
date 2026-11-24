const { MAX_DAYS, isId, senderOf, parseDay, parseInvoiceRequest, vatCentsOf, buildInvoice, missingDetails, invoiceFileName } = require('../src/utils/invoicing');

const NOW = new Date('2026-03-05T10:00:00Z');
const valid = { customerId: 3, from: '2026-02-01', to: '2026-02-28', tz: 'Europe/Berlin' };

describe('parseDay', () => {
  test.each([['2026-02-28'], ['2024-02-29'], ['1970-01-01'], ['2026-12-31']])('accepts %s', (day) => {
    expect(parseDay(day)).toBe(day);
  });

  test.each([
    ['2026-02-30'], ['2026-13-01'], ['2026-00-10'], ['2025-02-29'], ['2026-2-1'], ['26-02-01'], ['2026/02/01'], ['2026-02-01T00:00:00Z'],
    [' 2026-02-01'], ['1969-12-31'], [''], [null], [undefined], [20260201], [{}], [['2026-02-01']],
  ])('refuses %j', (day) => {
    expect(parseDay(day)).toBeNull();
  });
});

describe('parseInvoiceRequest', () => {
  test('reads a valid request, with the limits of the days as entry times in the time zone', () => {
    const { value, error } = parseInvoiceRequest({ ...valid, invoiceDate: '2026-03-01', lang: 'en' }, NOW);

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ customerId: 3, from: '2026-02-01', to: '2026-02-28', timeZone: 'Europe/Berlin', invoiceDate: '2026-03-01', lang: 'en' });
    // Berlin is one hour ahead of UTC in winter: the first of February starts at 23:00 UTC the day before, and "to" is included
    expect(value.range).toEqual({ from: '2026-01-31T23:00:00.000Z', to: '2026-02-28T23:00:00.000Z' });
  });

  test('takes a customer id as a number or as digits', () => {
    expect(parseInvoiceRequest({ ...valid, customerId: '12' }, NOW).value.customerId).toBe(12);
    expect(parseInvoiceRequest({ ...valid, customerId: 12 }, NOW).value.customerId).toBe(12);
  });

  test.each([[undefined], [null], [0], [-1], [1.5], ['abc'], ['0'], ['1.5'], [''], [true], [[1]], [{}], [2147483648], ['99999999999']])('refuses the customer id %j', (customerId) => {
    expect(parseInvoiceRequest({ ...valid, customerId }, NOW).error).toBe('customerId is required');
  });

  test.each([[{ from: undefined }], [{ to: undefined }], [{ from: '2026-02-30' }], [{ to: 'x' }], [{ from: 5 }]])('refuses the days %j', (change) => {
    expect(parseInvoiceRequest({ ...valid, ...change }, NOW).error).toBe('from and to are required as YYYY-MM-DD');
  });

  test('refuses from after to, and accepts the same day', () => {
    expect(parseInvoiceRequest({ ...valid, from: '2026-03-01', to: '2026-02-28' }, NOW).error).toBe('from must not be after to');
    expect(parseInvoiceRequest({ ...valid, from: '2026-02-10', to: '2026-02-10' }, NOW).value).toBeDefined();
  });

  // Berlin changes the clock on 29 March (23 hours) and on 25 October (25 hours): a single day still runs from midnight to midnight
  test.each([
    ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z'],
    ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z'],
  ])('a single day on which the clock changes (%s) runs from midnight to midnight in the time zone', (day, from, to) => {
    expect(parseInvoiceRequest({ ...valid, from: day, to: day }, NOW).value.range).toEqual({ from, to });
  });

  test('a period across the change of the clock has the offset of each end', () => {
    const { range } = parseInvoiceRequest({ ...valid, from: '2026-03-01', to: '2026-04-30' }, NOW).value;

    expect(range).toEqual({ from: '2026-02-28T23:00:00.000Z', to: '2026-04-30T22:00:00.000Z' });
  });

  test('a period over the turn of the year is counted in days: 2026-01-01 to 2027-01-01 is 366, one more is refused', () => {
    expect(parseInvoiceRequest({ ...valid, from: '2026-01-01', to: '2027-01-01' }, NOW).value).toBeDefined();
    expect(parseInvoiceRequest({ ...valid, from: '2026-01-01', to: '2027-01-02' }, NOW).error).toBe('The period can be at most 366 days');
  });

  test.each([['007'], [' 3'], ['3 '], ['+3'], ['3e0'], ['0x3']])('refuses the customer id %j in another form than plain digits', (customerId) => {
    expect(parseInvoiceRequest({ ...valid, customerId }, NOW).error).toBe('customerId is required');
  });

  test('refuses an invoice date before 1970', () => {
    expect(parseInvoiceRequest({ ...valid, invoiceDate: '1969-12-31' }, NOW).error).toBe('invoiceDate must be YYYY-MM-DD');
  });

  test('allows 366 days and refuses 367', () => {
    expect(MAX_DAYS).toBe(366);
    expect(parseInvoiceRequest({ ...valid, from: '2024-01-01', to: '2024-12-31' }, NOW).value).toBeDefined();
    expect(parseInvoiceRequest({ ...valid, from: '2024-01-01', to: '2025-01-01' }, NOW).error).toBe('The period can be at most 366 days');
  });

  test('the invoice date is today in the time zone when it is left out', () => {
    // 23:30 UTC on 5 March is already 6 March in Berlin
    const late = new Date('2026-03-05T23:30:00Z');

    expect(parseInvoiceRequest(valid, late).value.invoiceDate).toBe('2026-03-06');
    expect(parseInvoiceRequest({ ...valid, tz: 'America/New_York' }, late).value.invoiceDate).toBe('2026-03-05');
    expect(parseInvoiceRequest({ ...valid, tz: undefined }, late).value.invoiceDate).toBe('2026-03-05');
  });

  test.each([['2026-02-30'], ['today'], [null], [5], ['']])('refuses the invoice date %j', (invoiceDate) => {
    expect(parseInvoiceRequest({ ...valid, invoiceDate }, NOW).error).toBe('invoiceDate must be YYYY-MM-DD');
  });

  test('an unknown time zone or language is ignored', () => {
    const { value } = parseInvoiceRequest({ ...valid, tz: 'Mars/Base', lang: 'fr' }, NOW);

    expect(value.timeZone).toBe('UTC');
    expect(value.lang).toBeUndefined();
  });

  test.each([[null], [undefined], ['text'], [5], [[]]])('refuses %j as the request', (body) => {
    expect(parseInvoiceRequest(body, NOW).error).toBe('The request must be an object');
  });
});

describe('vatCentsOf', () => {
  test.each([
    [10000, 19, 1900], [10000, 7, 700], [10000, 0, 0], [114250, 19, 21708], [1, 19, 0], [3, 19, 1], [5, 19, 1], [0, 19, 0],
    // x.5 cents round up: 250 x 19 % = 47.5
    [250, 19, 48],
  ])('%i cents at %i %% is %i', (net, rate, expected) => {
    expect(vatCentsOf(net, { vatMode: 'regular', vatRate: rate })).toBe(expected);
  });

  test('a small business charges none, whatever the rate', () => {
    expect(vatCentsOf(10000, { vatMode: 'small_business', vatRate: 19 })).toBe(0);
  });
});

describe('buildInvoice', () => {
  // Entries as the report has them: an hourly rate per project, and whole minutes
  const entry = (project, projectId, minutes, rate, extra = {}) => ({
    project_id: projectId, project_name: project, hourly_rate: rate,
    start_time: '2026-02-02T08:00:00Z', end_time: new Date(Date.parse('2026-02-02T08:00:00Z') + minutes * 60000).toISOString(), ...extra,
  });
  const regular = { vatMode: 'regular', vatRate: 19 };

  test('makes one line per project, sorted by name, and adds up the cents of its entries', () => {
    const { lines, netCents, vatCents, grossCents } = buildInvoice([
      entry('Website', 1, 60, '80.00'), entry('Beratung', 2, 90, '95.00'), entry('Website', 1, 30, '80.00'),
    ], regular);

    expect(lines.map((line) => [line.name, line.minutes, line.rateCents, line.cents])).toEqual([['Beratung', 90, 9500, 14250], ['Website', 90, 8000, 12000]]);
    expect(netCents).toBe(26250);
    expect(vatCents).toBe(4988);
    expect(grossCents).toBe(31238);
  });

  test('each entry is rounded to cents on its own, like the report: 1:05 h at 95,00 is 102,92', () => {
    const { lines } = buildInvoice([entry('Website', 1, 65, '95.00')], regular);

    expect(lines[0].cents).toBe(10292);
  });

  test('uses the rounded hours of an entry (billed_hours) when there are some', () => {
    const { lines } = buildInvoice([entry('Website', 1, 65, '80.00', { billed_hours: '1.50' })], regular);

    expect(lines[0].minutes).toBe(90);
    expect(lines[0].cents).toBe(12000);
  });

  test('leaves out a project with no counted time, such as one that is still running', () => {
    const { lines } = buildInvoice([entry('Website', 1, 60, '80.00'), entry('Laufend', 2, 0, '80.00', { end_time: null })], regular);

    expect(lines.map((line) => line.name)).toEqual(['Website']);
  });

  test('a small business has no VAT and the same gross as net', () => {
    const { netCents, vatCents, grossCents } = buildInvoice([entry('Website', 1, 60, '80.00')], { vatMode: 'small_business', vatRate: 19 });

    expect([netCents, vatCents, grossCents]).toEqual([8000, 0, 8000]);
  });

  test('without entries there are no lines and the totals are 0', () => {
    expect(buildInvoice([], regular)).toEqual({ lines: [], netCents: 0, vatCents: 0, grossCents: 0 });
  });

  test('a project with a rate of 0 is a line with an amount of 0', () => {
    const { lines, grossCents } = buildInvoice([entry('Intern', 1, 60, '0.00')], regular);

    expect(lines[0].cents).toBe(0);
    expect(grossCents).toBe(0);
  });

  test('projects with the same name stay apart and keep a stable order by id', () => {
    const { lines } = buildInvoice([entry('Website', 2, 60, '80.00'), entry('Website', 1, 60, '90.00')], regular);

    expect(lines.map((line) => line.projectId)).toEqual([1, 2]);
  });
});

describe('missingDetails', () => {
  const sender = { name: 'Jana', address: 'Weg 1', taxId: 'DE1' };
  const customer = { address: 'Straße 2' };

  test('is empty when everything is there', () => {
    expect(missingDetails({ sender, customer, lineCount: 1 })).toEqual([]);
  });

  test.each([
    [{ sender: { ...sender, name: null } }, ['senderName']],
    [{ sender: { ...sender, address: null } }, ['senderAddress']],
    [{ sender: { ...sender, taxId: null } }, ['senderTaxId']],
    [{ customer: { address: null } }, ['customerAddress']],
    [{ lineCount: 0 }, ['noEntries']],
    [{ sender: {}, customer: {}, lineCount: 0 }, ['senderName', 'senderAddress', 'senderTaxId', 'customerAddress', 'noEntries']],
  ])('names what is missing for %j', (change, codes) => {
    expect(missingDetails({ sender, customer, lineCount: 1, ...change })).toEqual(codes);
  });

  test("the customer's tax ID and your email and bank details are optional", () => {
    expect(missingDetails({ sender, customer: { address: 'x', taxId: null }, lineCount: 1 })).toEqual([]);
  });
});

describe('invoiceFileName', () => {
  test.each([
    ['2026-0007', 'invoice-2026-0007.pdf'],
    ['RE/2026/03/05', 'invoice-RE_2026_03_05.pdf'],
    ['Rechnung 7', 'invoice-Rechnung_7.pdf'],
    ['../../etc', 'invoice-.._.._etc.pdf'],
    ['a"b\r\nc', 'invoice-a_b_c.pdf'],
    ['Ä-1', 'invoice-_-1.pdf'],
  ])('%j becomes %j', (number, name) => {
    expect(invoiceFileName(number)).toBe(name);
  });

  test('takes another extension', () => {
    expect(invoiceFileName('7', 'xml')).toBe('invoice-7.xml');
  });
});

describe('isId', () => {
  test.each([['1'], ['42'], ['2147483647'], ['1234567890']])('accepts %j', (id) => {
    expect(isId(id)).toBe(true);
  });

  test.each([['0'], ['007'], ['-1'], ['1.5'], [' 1'], ['1 '], ['2147483648'], ['9999999999'], ['12345678901'], [''], ['abc'], [1], [null], [undefined], [['1']]])('refuses %j', (id) => {
    expect(isId(id)).toBe(false);
  });
});

describe('senderOf', () => {
  test('takes your details out of the settings, under the names the invoice uses', () => {
    expect(senderOf({ senderName: 'Jana', senderAddress: 'Weg 5', senderEmail: null, senderTaxId: '1', senderBankDetails: 'IBAN', vatMode: 'regular', showAmounts: true })).toEqual({
      name: 'Jana', address: 'Weg 5', email: null, taxId: '1', bankDetails: 'IBAN',
    });
  });
});

describe('parseInvoiceRequest: groupByTask', () => {
  const body = { customerId: 3, from: '2026-02-01', to: '2026-02-28', tz: 'Europe/Berlin' };

  test('is off by default and on for true', () => {
    expect(parseInvoiceRequest(body).value.groupByTask).toBe(false);
    expect(parseInvoiceRequest({ ...body, groupByTask: true }).value.groupByTask).toBe(true);
    expect(parseInvoiceRequest({ ...body, groupByTask: false }).value.groupByTask).toBe(false);
  });

  test('refuses anything but true or false', () => {
    for (const groupByTask of ['true', 1, null, {}]) {
      expect(parseInvoiceRequest({ ...body, groupByTask }).error).toBe('groupByTask must be true or false');
    }
  });
});
