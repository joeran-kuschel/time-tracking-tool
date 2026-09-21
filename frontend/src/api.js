const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = {
  // Customers
  getCustomers: async () => {
    const response = await fetch(`${API_URL}/customers`);
    return response.json();
  },

  createCustomer: async (name, email) => {
    const response = await fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    return response.json();
  },

  // Projects
  getProjects: async (customerId) => {
    const response = await fetch(`${API_URL}/projects/customer/${customerId}`);
    return response.json();
  },

  createProject: async (customerId, name, hourlyRate) => {
    const response = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, name, hourlyRate })
    });
    return response.json();
  },

  // Time Entries
  createTimeEntry: async (projectId, startTime, description) => {
    const response = await fetch(`${API_URL}/time-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, startTime, description })
    });
    return response.json();
  },

  stopTimeEntry: async (id, endTime) => {
    const response = await fetch(`${API_URL}/time-entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endTime })
    });
    return response.json();
  },

  getTimeEntries: async (projectId) => {
    const response = await fetch(`${API_URL}/time-entries/project/${projectId}`);
    return response.json();
  },

  // Reports
  getMonthlyReport: async (customerId, month, year) => {
    const response = await fetch(`${API_URL}/reports/customer/${customerId}?month=${month}&year=${year}`);
    return response.json();
  },

  downloadPDF: async (customerId, month, year) => {
    const url = `${API_URL}/reports/customer/${customerId}/pdf?month=${month}&year=${year}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `abrechnung-${year}-${month}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
