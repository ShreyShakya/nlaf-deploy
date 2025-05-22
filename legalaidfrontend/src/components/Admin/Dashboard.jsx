"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Users,
  FileText,
  Calendar,
  Shield,
  Menu,
  X,
  Upload,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react"
import styles from "./Dashboard.module.css"
import LawyersList from "./LawyersList"
import ClientsList from "./ClientsList"
import CasesList from "./CasesList"
import AppointmentsList from "./AppointmentsList"
import {
  getDocumentTemplates,
  uploadDocumentTemplate,
  deleteDocumentTemplate,
  getLawyers,
  getKycVerifications,
  updateKycStatus,
  getKycDocument,
} from "./api"

const Dashboard = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("lawyers")
  const [file, setFile] = useState(null)
  const [uploadMessage, setUploadMessage] = useState("")
  const [uploadError, setUploadError] = useState("")
  const [templates, setTemplates] = useState([])
  const [kycVerifications, setKycVerifications] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [loadingKyc, setLoadingKyc] = useState(false)
  const [deleting, setDeleting] = useState({})
  const [updatingKyc, setUpdatingKyc] = useState({})
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")
  const [notifications, setNotifications] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Apply theme
  useEffect(() => {
    document.body.className = theme === "dark" ? styles.darkTheme : ""
    localStorage.setItem("theme", theme)
  }, [theme])

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("adminToken")
      if (!token) {
        addNotification("Please log in to access the dashboard", "error")
        navigate("/admin/login")
        return
      }

      try {
        await getLawyers()
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem("adminToken")
          localStorage.removeItem("admin")
          navigate("/admin/login")
        }
      }
    }

    validateToken()
  }, [navigate])

  // Clear messages when switching tabs
  useEffect(() => {
    if (activeTab !== "documents" && activeTab !== "kyc") {
      setUploadMessage("")
      setUploadError("")
    }
  }, [activeTab])

  // Fetch templates when switching to Documents tab
  useEffect(() => {
    if (activeTab === "documents") {
      const fetchTemplates = async () => {
        setLoadingTemplates(true)
        try {
          const response = await getDocumentTemplates()
          setTemplates(response.data.templates)
        } catch (error) {
          console.error("Error fetching templates:", error)
          setUploadError("Failed to load templates")
          addNotification("Failed to load templates", "error")
        } finally {
          setLoadingTemplates(false)
        }
      }
      fetchTemplates()
    }
  }, [activeTab])

  // Fetch KYC verifications when switching to KYC tab
  useEffect(() => {
    if (activeTab === "kyc") {
      const fetchKycVerifications = async () => {
        setLoadingKyc(true)
        try {
          const response = await getKycVerifications()
          setKycVerifications(response.data.kyc_verifications)
        } catch (error) {
          console.error("Error fetching KYC verifications:", error)
          setUploadError("Failed to load KYC verifications")
          addNotification("Failed to load KYC verifications", "error")
        } finally {
          setLoadingKyc(false)
        }
      }
      fetchKycVerifications()
    }
  }, [activeTab])

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light")
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

  const addNotification = (message, type = "success") => {
    const id = Date.now()
    setNotifications((prev) => [...prev, { id, message, type }])
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000)
  }

  const handleLogout = () => {
    localStorage.removeItem("adminToken")
    localStorage.removeItem("admin")
    addNotification("Logged out successfully", "success")
    navigate("/admin/login")
  }

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setUploadMessage("")
    setUploadError("")
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      setUploadError("Please select a file to upload")
      addNotification("Please select a file to upload", "error")
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await uploadDocumentTemplate(formData)
      setUploadMessage(response.data.message)
      setUploadError("")
      setFile(null)
      document.getElementById("fileInput").value = ""
      const templatesResponse = await getDocumentTemplates()
      setTemplates(templatesResponse.data.templates)
      addNotification("Template uploaded successfully", "success")
    } catch (error) {
      setUploadMessage("")
      const errorMsg =
        error.response?.status === 400
          ? error.response?.data?.error || "Invalid file. Please upload a PDF, DOC, or DOCX file."
          : error.response?.status === 401
            ? "Unauthorized. Please log in again."
            : "Failed to upload template. Please try again."
      setUploadError(errorMsg)
      addNotification(errorMsg, "error")
    }
  }

  const handleDelete = async (filename) => {
    if (!window.confirm("Are you sure you want to delete this template?")) {
      return
    }

    setDeleting((prev) => ({ ...prev, [filename]: true }))
    const previousTemplates = [...templates]
    setTemplates((prevTemplates) =>
      prevTemplates.filter((template) => template.download_url !== `/api/document-templates/${filename}`),
    )
    setUploadMessage("Template deleted successfully!")
    setUploadError("")

    try {
      await deleteDocumentTemplate(filename)
      const templatesResponse = await getDocumentTemplates()
      setTemplates(templatesResponse.data.templates)
      addNotification("Template deleted successfully", "success")
    } catch (error) {
      setTemplates(previousTemplates)
      setUploadMessage("")
      setUploadError(error.response?.data?.error || "Failed to delete template")
      addNotification(error.response?.data?.error || "Failed to delete template", "error")
    } finally {
      setDeleting((prev) => ({ ...prev, [filename]: false }))
    }
  }

  const handleKycStatusUpdate = async (kycId, status) => {
    setUpdatingKyc((prev) => ({ ...prev, [kycId]: true }))
    const previousKycVerifications = [...kycVerifications]
    setKycVerifications((prev) => prev.map((kyc) => (kyc.id === kycId ? { ...kyc, kyc_status: status } : kyc)))
    setUploadMessage(`KYC status updated to ${status}!`)
    setUploadError("")

    try {
      await updateKycStatus(kycId, { status })
      const response = await getKycVerifications()
      setKycVerifications(response.data.kyc_verifications)
      addNotification(`KYC status updated to ${status}`, "success")
    } catch (error) {
      setKycVerifications(previousKycVerifications)
      setUploadMessage("")
      setUploadError(error.response?.data?.error || `Failed to update KYC status to ${status}`)
      addNotification(error.response?.data?.error || `Failed to update KYC status to ${status}`, "error")
    } finally {
      setUpdatingKyc((prev) => ({ ...prev, [kycId]: false }))
    }
  }

  const handleViewDocument = async (filename) => {
    try {
      const response = await getKycDocument(filename)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setUploadError("")
      addNotification("Document downloaded successfully", "success")
    } catch (error) {
      console.error("Error fetching document:", error)
      const errorMsg =
        error.response?.status === 401 || error.response?.status === 403
          ? "Unauthorized. Please log in again."
          : error.response?.status === 404
            ? "Document not found."
            : "Failed to fetch document. Please try again."
      setUploadError(errorMsg)
      addNotification(errorMsg, "error")
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken")
        localStorage.removeItem("admin")
        navigate("/admin/login")
      }
    }
  }

  const handleTemplateDetails = (template) => {
    setSelectedTemplate(template)
  }

  return (
    <div className={`${styles.dashboardPage} ${theme === "dark" ? styles.darkTheme : ""}`}>
      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}>
          <div className={styles.sidebarHeader}>
            <button className={styles.menuButton} onClick={toggleSidebar}>
              {isSidebarOpen ? <X className={styles.icon} /> : <Menu className={styles.icon} />}
            </button>
            <div className={styles.logoLink}>
              <span>Legal Admin</span>
            </div>
          </div>

          <div className={styles.sidebarSubheader}>
            <div className={styles.adminTitle}>Admin Panel</div>
          </div>

          <nav className={styles.sidebarNav}>
            <button
              onClick={() => setActiveTab("lawyers")}
              className={`${styles.navLink} ${activeTab === "lawyers" ? styles.activeNavLink : ""}`}
            >
              <Users className={styles.navIcon} />
              <span>Lawyers</span>
              {activeTab === "lawyers" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => setActiveTab("clients")}
              className={`${styles.navLink} ${activeTab === "clients" ? styles.activeNavLink : ""}`}
            >
              <Users className={styles.navIcon} />
              <span>Clients</span>
              {activeTab === "clients" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => setActiveTab("cases")}
              className={`${styles.navLink} ${activeTab === "cases" ? styles.activeNavLink : ""}`}
            >
              <FileText className={styles.navIcon} />
              <span>Cases</span>
              {activeTab === "cases" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => setActiveTab("appointments")}
              className={`${styles.navLink} ${activeTab === "appointments" ? styles.activeNavLink : ""}`}
            >
              <Calendar className={styles.navIcon} />
              <span>Appointments</span>
              {activeTab === "appointments" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`${styles.navLink} ${activeTab === "documents" ? styles.activeNavLink : ""}`}
            >
              <FileText className={styles.navIcon} />
              <span>Documents</span>
              {activeTab === "documents" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => setActiveTab("kyc")}
              className={`${styles.navLink} ${activeTab === "kyc" ? styles.activeNavLink : ""}`}
            >
              <Shield className={styles.navIcon} />
              <span>KYC Verifications</span>
              {activeTab === "kyc" && <ChevronRight className={styles.activeIcon} />}
            </button>
          </nav>

          <div className={styles.sidebarFooter}>
            <button onClick={handleLogout} className={styles.logoutButtonSidebar}>
              Logout
            </button>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.topBar}>
            <div className={styles.pageTitle}>
              {activeTab === "lawyers" && "Lawyers Management"}
              {activeTab === "clients" && "Clients Management"}
              {activeTab === "cases" && "Cases Management"}
              {activeTab === "appointments" && "Appointments Management"}
              {activeTab === "documents" && "Document Templates"}
              {activeTab === "kyc" && "KYC Verifications"}
            </div>
            <div className={styles.headerActions}>
              <span className={styles.currentDate}>
                {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <button
                onClick={toggleTheme}
                className={styles.themeButton}
                data-tooltip-id="theme-tooltip"
                data-tooltip-content="Toggle theme"
              >
                {theme === "light" ? <Moon className={styles.icon} /> : <Sun className={styles.icon} />}
              </button>
              <button onClick={handleLogout} className={styles.logoutButton}>
                Logout
              </button>
            </div>
          </div>

          <div className={styles.dashboardContent}>
            {activeTab === "lawyers" && (
              <div className={styles.dashboardGrid}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Lawyers Management</h2>
                  </div>
                  <LawyersList />
                </div>
              </div>
            )}
            
            {activeTab === "clients" && (
              <div className={styles.dashboardGrid}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Clients Management</h2>
                  </div>
                  <ClientsList />
                </div>
              </div>
            )}
            
            {activeTab === "cases" && (
              <div className={styles.dashboardGrid}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Cases Management</h2>
                  </div>
                  <CasesList />
                </div>
              </div>
            )}
            
            {activeTab === "appointments" && (
              <div className={styles.dashboardGrid}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Appointments Management</h2>
                  </div>
                  <AppointmentsList />
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className={styles.dashboardGrid}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Upload Document Template</h2>
                  </div>
                  <form onSubmit={handleUpload} className={styles.uploadForm}>
                    <div className={styles.formGroup}>
                      <label htmlFor="fileInput" className={styles.fileLabel}>
                        Select Document (PDF, DOC, DOCX)
                      </label>
                      <div className={styles.fileInputWrapper}>
                        <input
                          type="file"
                          id="fileInput"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                          className={styles.fileInput}
                        />
                      </div>
                      {file && <div className={styles.selectedFile}>Selected: {file.name}</div>}
                    </div>
                    <button type="submit" className={styles.primaryButton}>
                      <Upload className={styles.buttonIcon} /> Upload Template
                    </button>
                  </form>
                  {uploadMessage && <div className={styles.successMessage}>{uploadMessage}</div>}
                  {uploadError && (
                    <div className={styles.errorMessage}>
                      <AlertCircle className={styles.errorIcon} /> {uploadError}
                    </div>
                  )}
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Document Templates</h2>
                  </div>
                  {loadingTemplates ? (
                    <div className={styles.loadingState}>
                      <div className={styles.miniLoader}></div>
                      <p>Loading templates...</p>
                    </div>
                  ) : templates.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>No templates uploaded yet.</p>
                    </div>
                  ) : (
                    <div className={styles.tableWrapper}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Template Name</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {templates.map((template) => {
                            const filename = template.download_url.split("/").pop()
                            return (
                              <tr key={template.download_url}>
                                <td className={styles.primaryCell}>{template.original_filename}</td>
                                <td>
                                  <div className={styles.actionButtons}>
                                    <a
                                      href={`http://127.0.0.1:5000${template.download_url}`}
                                      download
                                      className={styles.actionButton}
                                    >
                                      <Download className={styles.buttonIcon} /> Download
                                    </a>
                                    <button
                                      onClick={() => handleDelete(filename)}
                                      className={styles.deleteButton}
                                      disabled={deleting[filename]}
                                    >
                                      {deleting[filename] ? (
                                        <div className={styles.miniLoader}></div>
                                      ) : (
                                        <Trash2 className={styles.buttonIcon} />
                                      )}{" "}
                                      {deleting[filename] ? "Deleting..." : "Delete"}
                                    </button>
                                    <button
                                      onClick={() => handleTemplateDetails(template)}
                                      className={styles.iconButton}
                                    >
                                      <MoreVertical className={styles.buttonIcon} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "kyc" && (
              <div className={styles.dashboardGrid}>
                {uploadMessage && (
                  <div className={styles.successMessage}>
                    <CheckCircle className={styles.successIcon} /> {uploadMessage}
                  </div>
                )}
                {uploadError && (
                  <div className={styles.errorMessage}>
                    <AlertCircle className={styles.errorIcon} /> {uploadError}
                  </div>
                )}

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>KYC Verification Requests</h2>
                  </div>
                  {loadingKyc ? (
                    <div className={styles.loadingState}>
                      <div className={styles.miniLoader}></div>
                      <p>Loading KYC verifications...</p>
                    </div>
                  ) : kycVerifications.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>No KYC verifications submitted yet.</p>
                    </div>
                  ) : (
                    <div className={styles.kycList}>
                      {kycVerifications.map((kyc) => {
                        const filename = kyc.identification_document.split("/").pop()
                        return (
                          <div key={kyc.id} className={styles.kycCard}>
                            <div className={styles.kycHeader}>
                              <h3 className={styles.kycName}>{kyc.lawyer_name}</h3>
                              <span
                                className={`${styles.statusBadge} ${
                                  styles[`status${kyc.kyc_status.charAt(0).toUpperCase() + kyc.kyc_status.slice(1)}`]
                                }`}
                              >
                                {kyc.kyc_status}
                              </span>
                            </div>
                            <div className={styles.kycDetails}>
                              <div className={styles.kycDetail}>
                                <div className={styles.detailLabel}>Email</div>
                                <div className={styles.detailValue}>{kyc.lawyer_email}</div>
                              </div>
                              <div className={styles.kycDetail}>
                                <div className={styles.detailLabel}>License Number</div>
                                <div className={styles.detailValue}>{kyc.license_number}</div>
                              </div>
                              <div className={styles.kycDetail}>
                                <div className={styles.detailLabel}>Contact Number</div>
                                <div className={styles.detailValue}>{kyc.contact_number}</div>
                              </div>
                              <div className={styles.kycDetail}>
                                <div className={styles.detailLabel}>Submitted</div>
                                <div className={styles.detailValue}>{new Date(kyc.submitted_at).toLocaleString()}</div>
                              </div>
                            </div>
                            <div className={styles.kycActions}>
                              <button onClick={() => handleViewDocument(filename)} className={styles.actionButton}>
                                <Download className={styles.buttonIcon} /> View Document
                              </button>
                              {kyc.kyc_status === "submitted" && (
                                <div className={styles.kycStatusActions}>
                                  <button
                                    onClick={() => handleKycStatusUpdate(kyc.id, "rejected")}
                                    className={styles.rejectButton}
                                    disabled={updatingKyc[kyc.id]}
                                  >
                                    {updatingKyc[kyc.id] ? <div className={styles.miniLoader}></div> : "Reject"}
                                  </button>
                                  <button
                                    onClick={() => handleKycStatusUpdate(kyc.id, "verified")}
                                    className={styles.approveButton}
                                    disabled={updatingKyc[kyc.id]}
                                  >
                                    {updatingKyc[kyc.id] ? <div className={styles.miniLoader}></div> : "Approve"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Template Details Modal */}
      {selectedTemplate && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTemplate(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Template Details</h3>
              <button onClick={() => setSelectedTemplate(null)} className={styles.closeButton}>
                <X className={styles.closeIcon} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}>File Name</div>
                <div className={styles.detailValue}>{selectedTemplate.original_filename}</div>
              </div>
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}>Download URL</div>
                <div className={styles.detailValue}>{selectedTemplate.download_url}</div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <a
                href={`http://127.0.0.1:5000${selectedTemplate.download_url}`}
                download
                className={styles.primaryButton}
              >
                <Download className={styles.buttonIcon} /> Download
              </a>
              <button onClick={() => setSelectedTemplate(null)} className={styles.secondaryButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className={styles.notificationContainer}>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`${styles.notification} ${
              notification.type === "error" ? styles.errorNotification : styles.successNotification
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle className={styles.notificationIcon} />
            ) : (
              <AlertCircle className={styles.notificationIcon} />
            )}
            {notification.message}
          </div>
        ))}
      </div>

      {/* Loading Overlay */}
      <div className={styles.loaderOverlay} style={{ display: loadingTemplates || loadingKyc ? "flex" : "none" }}>
        <div className={styles.loader}></div>
      </div>
    </div>
  );
}

export default Dashboard;
