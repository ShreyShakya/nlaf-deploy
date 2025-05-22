import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import LawyersList from './LawyersList';
import ClientsList from './ClientsList';
import CasesList from './CasesList';
import AppointmentsList from './AppointmentsList';
import { getDocumentTemplates, uploadDocumentTemplate, deleteDocumentTemplate, getLawyers, getKycVerifications, updateKycStatus, getKycDocument } from './api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lawyers');
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [kycVerifications, setKycVerifications] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingKyc, setLoadingKyc] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [updatingKyc, setUpdatingKyc] = useState({});

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      try {
        await getLawyers();
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('admin');
          navigate('/admin/login');
        }
      }
    };

    validateToken();
  }, [navigate]);

  // Clear messages when switching tabs
  useEffect(() => {
    if (activeTab !== 'documents' && activeTab !== 'kyc') {
      setUploadMessage('');
      setUploadError('');
    }
  }, [activeTab]);

  // Fetch templates when switching to Documents tab
  useEffect(() => {
    if (activeTab === 'documents') {
      const fetchTemplates = async () => {
        setLoadingTemplates(true);
        try {
          const response = await getDocumentTemplates();
          setTemplates(response.data.templates);
        } catch (error) {
          console.error('Error fetching templates:', error);
          setUploadError('Failed to load templates');
        } finally {
          setLoadingTemplates(false);
        }
      };
      fetchTemplates();
    }
  }, [activeTab]);

  // Fetch KYC verifications when switching to KYC tab
  useEffect(() => {
    if (activeTab === 'kyc') {
      const fetchKycVerifications = async () => {
        setLoadingKyc(true);
        try {
          const response = await getKycVerifications();
          setKycVerifications(response.data.kyc_verifications);
        } catch (error) {
          console.error('Error fetching KYC verifications:', error);
          setUploadError('Failed to load KYC verifications');
        } finally {
          setLoadingKyc(false);
        }
      };
      fetchKycVerifications();
    }
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    navigate('/admin/login');
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setUploadMessage('');
    setUploadError('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await uploadDocumentTemplate(formData);
      setUploadMessage(response.data.message);
      setUploadError('');
      setFile(null);
      document.getElementById('fileInput').value = '';
      const templatesResponse = await getDocumentTemplates();
      setTemplates(templatesResponse.data.templates);
    } catch (error) {
      setUploadMessage('');
      const errorMsg =
        error.response?.status === 400
          ? error.response?.data?.error || 'Invalid file. Please upload a PDF, DOC, or DOCX file.'
          : error.response?.status === 401
          ? 'Unauthorized. Please log in again.'
          : 'Failed to upload template. Please try again.';
      setUploadError(errorMsg);
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    setDeleting((prev) => ({ ...prev, [filename]: true }));
    const previousTemplates = [...templates];
    setTemplates((prevTemplates) =>
      prevTemplates.filter((template) => template.download_url !== `/api/document-templates/${filename}`)
    );
    setUploadMessage('Template deleted successfully!');
    setUploadError('');

    try {
      await deleteDocumentTemplate(filename);
      const templatesResponse = await getDocumentTemplates();
      setTemplates(templatesResponse.data.templates);
    } catch (error) {
      setTemplates(previousTemplates);
      setUploadMessage('');
      setUploadError(error.response?.data?.error || 'Failed to delete template');
    } finally {
      setDeleting((prev) => ({ ...prev, [filename]: false }));
    }
  };

  const handleKycStatusUpdate = async (kycId, status) => {
    setUpdatingKyc((prev) => ({ ...prev, [kycId]: true }));
    const previousKycVerifications = [...kycVerifications];
    setKycVerifications((prev) =>
      prev.map((kyc) =>
        kyc.id === kycId ? { ...kyc, kyc_status: status } : kyc
      )
    );
    setUploadMessage(`KYC status updated to ${status}!`);
    setUploadError('');

    try {
      await updateKycStatus(kycId, { status });
      const response = await getKycVerifications();
      setKycVerifications(response.data.kyc_verifications);
    } catch (error) {
      setKycVerifications(previousKycVerifications);
      setUploadMessage('');
      setUploadError(error.response?.data?.error || `Failed to update KYC status to ${status}`);
    } finally {
      setUpdatingKyc((prev) => ({ ...prev, [kycId]: false }));
    }
  };

  const handleViewDocument = async (filename) => {
    try {
      const response = await getKycDocument(filename);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setUploadError('');
    } catch (error) {
      console.error('Error fetching document:', error);
      const errorMsg =
        error.response?.status === 401 || error.response?.status === 403
          ? 'Unauthorized. Please log in again.'
          : error.response?.status === 404
          ? 'Document not found.'
          : 'Failed to fetch document. Please try again.';
      setUploadError(errorMsg);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        navigate('/admin/login');
      }
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className={styles.logoutButton}>
          Logout
        </button>
      </header>
      <nav className={styles.nav}>
        <button
          className={activeTab === 'lawyers' ? styles.active : ''}
          onClick={() => setActiveTab('lawyers')}
        >
          Lawyers
        </button>
        <button
          className={activeTab === 'clients' ? styles.active : ''}
          onClick={() => setActiveTab('clients')}
        >
          Clients
        </button>
        <button
          className={activeTab === 'cases' ? styles.active : ''}
          onClick={() => setActiveTab('cases')}
        >
          Cases
        </button>
        <button
          className={activeTab === 'appointments' ? styles.active : ''}
          onClick={() => setActiveTab('appointments')}
        >
          Appointments
        </button>
        <button
          className={activeTab === 'documents' ? styles.active : ''}
          onClick={() => setActiveTab('documents')}
        >
          Documents
        </button>
        <button
          className={activeTab === 'kyc' ? styles.active : ''}
          onClick={() => setActiveTab('kyc')}
        >
          KYC Verifications
        </button>
      </nav>
      <main className={styles.main}>
        {activeTab === 'lawyers' && <LawyersList />}
        {activeTab === 'clients' && <ClientsList />}
        {activeTab === 'cases' && <CasesList />}
        {activeTab === 'appointments' && <AppointmentsList />}
        {activeTab === 'documents' && (
          <div className={styles.uploadSection}>
            <h2>Upload Document Template</h2>
            <form onSubmit={handleUpload} className={styles.uploadForm}>
              <input
                type="file"
                id="fileInput"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
              <button type="submit" className={styles.uploadButton}>
                Upload
              </button>
            </form>
            {uploadMessage && <p className={styles.successMessage}>{uploadMessage}</p>}
            {uploadError && <p className={styles.errorMessage}>{uploadError}</p>}
            <h2>Uploaded Templates</h2>
            {loadingTemplates ? (
              <p>Loading templates...</p>
            ) : templates.length === 0 ? (
              <p>No templates uploaded yet.</p>
            ) : (
              <div className={styles.templatesList}>
                {templates.map((template) => {
                  const filename = template.download_url.split('/').pop();
                  return (
                    <div key={template.download_url} className={styles.templateItem}>
                      <span>{template.original_filename}</span>
                      <div className={styles.buttonGroup}>
                        <a
                          href={`http://127.0.0.1:5000${template.download_url}`}
                          download
                          className={styles.downloadButton}
                        >
                          Download
                        </a>
                        <button
                          onClick={() => handleDelete(filename)}
                          className={styles.deleteButton}
                          disabled={deleting[filename]}
                        >
                          {deleting[filename] ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {activeTab === 'kyc' && (
          <div className={styles.kycSection}>
            <h2>KYC Verifications</h2>
            {uploadMessage && <p className={styles.successMessage}>{uploadMessage}</p>}
            {uploadError && <p className={styles.errorMessage}>{uploadError}</p>}
            {loadingKyc ? (
              <p>Loading KYC verifications...</p>
            ) : kycVerifications.length === 0 ? (
              <p>No KYC verifications submitted yet.</p>
            ) : (
              <div className={styles.kycList}>
                {kycVerifications.map((kyc) => {
                  const filename = kyc.identification_document.split('/').pop();
                  return (
                    <div key={kyc.id} className={styles.kycItem}>
                      <div className={styles.kycDetails}>
                        <p><strong>Lawyer:</strong> {kyc.lawyer_name} ({kyc.lawyer_email})</p>
                        <p><strong>License Number:</strong> {kyc.license_number}</p>
                        <p><strong>Contact Number:</strong> {kyc.contact_number}</p>
                        <p><strong>Status:</strong> {kyc.kyc_status.charAt(0).toUpperCase() + kyc.kyc_status.slice(1)}</p>
                        <p>
                          <strong>Document:</strong>{' '}
                          <button
                            onClick={() => handleViewDocument(filename)}
                            className={styles.downloadButton}
                          >
                            View Document
                          </button>
                        </p>
                        <p><strong>Submitted:</strong> {new Date(kyc.submitted_at).toLocaleString()}</p>
                      </div>
                      {kyc.kyc_status === 'submitted' && (
                        <div className={styles.buttonGroup}>
                          <button
                            onClick={() => handleKycStatusUpdate(kyc.id, 'verified')}
                            className={styles.approveButton}
                            disabled={updatingKyc[kyc.id]}
                          >
                            {updatingKyc[kyc.id] ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleKycStatusUpdate(kyc.id, 'rejected')}
                            className={styles.rejectButton}
                            disabled={updatingKyc[kyc.id]}
                          >
                            {updatingKyc[kyc.id] ? 'Processing...' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;