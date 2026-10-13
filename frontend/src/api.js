const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// status is the HTTP status, or 0 when the server can't be reached
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Called when a request is answered with 401 although the user was logged in: the session has ended
let sessionEndedHandler = () => {}
export const onSessionEnded = (handler) => { sessionEndedHandler = handler }

// Sends a request with the login cookie; answers that aren't ok throw ApiError with the backend's error message.
// endsSession: false for the requests where 401 is an expected answer (login, asking for the session)
async function send(url, options, { endsSession = true } = {}) {
  let response;
  try {
    response = await fetch(url, { credentials: 'include', ...options });
  } catch {
    throw new ApiError(0, 'Server not reachable');
  }

  if (!response.ok) {
    if (response.status === 401 && endsSession) sessionEndedHandler();
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error || response.statusText);
  }
  return response;
}

async function request(path, { method = 'GET', body, endsSession } = {}) {
  const options = body === undefined
    ? { method }
    : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };

  const response = await send(`${API_URL}${path}`, options, { endsSession });
  return response.json().catch(() => null);
}

// The file name from a Content-Disposition header, preferring the UTF-8 form (filename*=UTF-8''…)
export function fileNameFrom(header) {
  const utf8 = header?.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  const quoted = header?.match(/filename="((?:[^"\\]|\\.)*)"/);
  return quoted ? quoted[1].replace(/\\(.)/g, '$1') : 'report.pdf';
}

// Saves a blob as a file through a temporary link
function saveFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// The browser's time zone (e.g. "Europe/Berlin"): the backend limits months by it, like the dashboard does
const timeZone = () => encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);

const pdfUrl = (customerId, month, year, locale) =>
  `${API_URL}/reports/customer/${customerId}/pdf?month=${month}&year=${year}&lang=${locale}&tz=${timeZone()}`;

export const api = {
  // Login. 401 means the credentials are wrong (or, for getSession, that nobody is logged in)
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, endsSession: false }),

  // A 401 means the session was already gone, which is what logging out wants
  logout: () =>
    request('/auth/logout', { method: 'POST', endsSession: false }).catch((err) => {
      if (err.status === 401) return null;
      throw err;
    }),

  // { email } of the logged-in user, or null when nobody is logged in
  getSession: () =>
    request('/auth/me', { endsSession: false }).catch((err) => {
      if (err.status === 401) return null
      throw err
    }),

  // Customers
  getCustomers: () => request('/customers'),

  createCustomer: (name, email) =>
    request('/customers', { method: 'POST', body: { name, email } }),

  updateCustomer: (id, name, email) =>
    request(`/customers/${id}`, { method: 'PUT', body: { name, email } }),

  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  // Projects
  getProjects: (customerId) => request(`/projects/customer/${customerId}`),

  createProject: (customerId, name, hourlyRate) =>
    request('/projects', { method: 'POST', body: { customerId, name, hourlyRate } }),

  updateProject: (id, name, hourlyRate) =>
    request(`/projects/${id}`, { method: 'PUT', body: { name, hourlyRate } }),

  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // Time Entries; without endTime, createTimeEntry starts the timer
  createTimeEntry: (projectId, startTime, description, endTime) =>
    request('/time-entries', { method: 'POST', body: { projectId, startTime, description, endTime } }),

  // changes: { startTime, endTime, projectId, description }
  updateTimeEntry: (id, changes) =>
    request(`/time-entries/${id}`, { method: 'PATCH', body: changes }),

  deleteTimeEntry: (id) => request(`/time-entries/${id}`, { method: 'DELETE' }),

  stopTimeEntry: (id, endTime) =>
    request(`/time-entries/${id}`, { method: 'PATCH', body: { endTime } }),

  getActiveEntry: () => request('/time-entries/active'),

  // All entries of the customer's projects, with project_name
  getCustomerTimeEntries: (customerId) => request(`/time-entries/customer/${customerId}`),

  // Reports
  getMonthlyReport: (customerId, month, year) =>
    request(`/reports/customer/${customerId}?month=${month}&year=${year}&tz=${timeZone()}`),

  // status: 'draft', 'ready' or 'sent'
  setReportStatus: (customerId, month, year, status) =>
    request(`/reports/customer/${customerId}/status`, { method: 'PUT', body: { month, year, status } }),

  // The PDF shown in the browser instead of downloaded
  pdfPreviewUrl: (customerId, month, year, locale) => `${pdfUrl(customerId, month, year, locale)}&inline=1`,

  // Dashboard: entries starting in [from, to), recent entries, all projects and last month's report statuses
  getDashboard: (from, to, month, year) =>
    request(`/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&month=${month}&year=${year}&tz=${timeZone()}`),

  // Loads the PDF first, so a failed download throws ApiError instead of leaving the page
  downloadPDF: async (customerId, month, year, locale) => {
    const response = await send(pdfUrl(customerId, month, year, locale), { method: 'GET' });
    saveFile(await response.blob(), fileNameFrom(response.headers.get('Content-Disposition')));
  }
};
