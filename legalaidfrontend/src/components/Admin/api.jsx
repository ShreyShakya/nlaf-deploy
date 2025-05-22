import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:5000/api',
});

// Add admin token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Admin authentication
export const adminLogin = (email, password) =>
  api.post('/admin/login', { email, password });

// Lawyer management
export const getLawyers = () => api.get('/admin/lawyers');
export const deleteLawyer = (lawyerId) => api.delete(`/admin/lawyers/${lawyerId}`);

// Client management
export const getClients = () => api.get('/admin/clients');
export const deleteClient = (clientId) => api.delete(`/admin/clients/${clientId}`);

// Case management
export const getCases = () => api.get('/admin/cases');
export const deleteCase = (caseId) => api.delete(`/admin/cases/${caseId}`);

// Appointment management
export const getAppointments = () => api.get('/admin/appointments');
export const deleteAppointment = (appointmentId) =>
  api.delete(`/admin/appointments/${appointmentId}`);

// Document template management
export const getDocumentTemplates = () => api.get('/document-templates');
export const uploadDocumentTemplate = (formData) =>
  api.post('/admin/upload-template', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
export const deleteDocumentTemplate = (filename) =>
  api.delete(`/admin/delete-template/${filename}`);

// KYC verification management
export const getKycVerifications = () => api.get('/admin/kyc-verifications');
export const updateKycStatus = (kycId, data) =>
  api.put(`/admin/kyc-verifications/${kycId}/update-status`, data);

// KYC document fetch
export const getKycDocument = (filename) =>
  api.get(`/kyc_documents/${filename}`, {
    responseType: 'blob', // Handle binary data
  });