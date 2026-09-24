const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// status is the HTTP status, or 0 when the server can't be reached
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const options = body === undefined
    ? { method }
    : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new ApiError(0, 'Server not reachable');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || response.statusText);
  }
  return data;
}

const pdfUrl = (customerId, month, year, locale) =>
  `${API_URL}/reports/customer/${customerId}/pdf?month=${month}&year=${year}&lang=${locale}`;

export const api = {
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
    request(`/reports/customer/${customerId}?month=${month}&year=${year}`),

  // status: 'draft', 'ready' or 'sent'
  setReportStatus: (customerId, month, year, status) =>
    request(`/reports/customer/${customerId}/status`, { method: 'PUT', body: { month, year, status } }),

  // The PDF shown in the browser instead of downloaded
  pdfPreviewUrl: (customerId, month, year, locale) => `${pdfUrl(customerId, month, year, locale)}&inline=1`,

  // Dashboard: entries starting in [from, to), recent entries, all projects and last month's report statuses
  getDashboard: (from, to, month, year) =>
    request(`/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&month=${month}&year=${year}`),

  downloadPDF: async (customerId, month, year, locale) => {
    const link = document.createElement('a');
    link.href = pdfUrl(customerId, month, year, locale);
    link.download = `abrechnung-${year}-${month}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
