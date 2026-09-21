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

export const api = {
  // Customers
  getCustomers: () => request('/customers'),

  createCustomer: (name, email) =>
    request('/customers', { method: 'POST', body: { name, email } }),

  // Projects
  getProjects: (customerId) => request(`/projects/customer/${customerId}`),

  createProject: (customerId, name, hourlyRate) =>
    request('/projects', { method: 'POST', body: { customerId, name, hourlyRate } }),

  // Time Entries
  createTimeEntry: (projectId, startTime, description) =>
    request('/time-entries', { method: 'POST', body: { projectId, startTime, description } }),

  stopTimeEntry: (id, endTime) =>
    request(`/time-entries/${id}`, { method: 'PATCH', body: { endTime } }),

  getActiveEntry: () => request('/time-entries/active'),

  getTimeEntries: (projectId) => request(`/time-entries/project/${projectId}`),

  // Reports
  getMonthlyReport: (customerId, month, year) =>
    request(`/reports/customer/${customerId}?month=${month}&year=${year}`),

  downloadPDF: async (customerId, month, year, locale) => {
    const url = `${API_URL}/reports/customer/${customerId}/pdf?month=${month}&year=${year}&lang=${locale}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `abrechnung-${year}-${month}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
