"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText,
  Calendar,
  File,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Clock,
  Download,
  Send,
  ArrowLeft,
  Briefcase,
} from "lucide-react"
import axios from "axios"
import styles from "./ClientCaseDetails.module.css"

export default function ClientCaseDetails() {
  const { caseId } = useParams()
  const navigate = useNavigate()

  // State variables
  const [caseData, setCaseData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [timelineEvents, setTimelineEvents] = useState([])
  const [documents, setDocuments] = useState([])
  const [evidenceList, setEvidenceList] = useState([])
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")

  useEffect(() => {
    document.body.className = theme === "dark" ? styles.darkTheme : ""
  }, [theme])

  // Helper function for notifications
  const addNotification = (message, type = "success") => {
    const id = Date.now()
    setNotifications((prev) => [...prev, { id, message, type }])
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000)
  }

  // Fetch case details on mount
  useEffect(() => {
    const fetchCaseDetails = async () => {
      const token = localStorage.getItem("clientToken")
      if (!token) {
        addNotification("Please log in to access case details", "error")
        navigate("/client-login")
        return
      }

      setIsLoading(true)
      try {
        const response = await axios.get(`http://127.0.0.1:5000/api/client-case/${caseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const { case: caseDetails, timeline, documents, evidence, messages } = response.data
        setCaseData(caseDetails)
        setTimelineEvents(timeline)
        setDocuments(documents)
        setEvidenceList(evidence)
        setMessages(messages)
      } catch (err) {
        addNotification(err.response?.data?.error || "Failed to load case details", "error")
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem("clientToken")
          navigate("/client-login")
        }
      } finally {
        setIsLoading(false)
      }
    }
    fetchCaseDetails()
  }, [caseId, navigate])

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    setIsLoading(true)

    try {
      const token = localStorage.getItem("clientToken")
      const response = await axios.post(
        `http://127.0.0.1:5000/api/client-case/${caseId}/messages`,
        { message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setMessages([...messages, response.data.message])
      setNewMessage("")
      addNotification("Message sent successfully")
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to send message", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // Render loading state
  if (!caseData) {
    return (
      <div className={`${styles.caseDetailsPage} ${theme === "dark" ? styles.darkTheme : ""}`}>
        <div className={styles.loaderContainer}>
          <div className={styles.loader}></div>
          <p>Loading case details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.caseDetailsPage} ${theme === "dark" ? styles.darkTheme : ""}`}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={() => navigate("/client-dashboard")} className={styles.backButton}>
            <ArrowLeft className={styles.buttonIcon} />
            <span>Back to Dashboard</span>
          </button>
          <h1>
            <Briefcase className={styles.headerIcon} />
            Case: {caseData.title}
          </h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.caseStatus}>
            <span
              className={`${styles.statusBadge} ${styles[`status${caseData.status.charAt(0).toUpperCase() + caseData.status.slice(1)}`]}`}
            >
              {caseData.status}
            </span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.contentGrid}>
          {/* Main column - Case information */}
          <div className={styles.mainColumn}>
            {/* Case Overview Section */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  <FileText className={styles.cardIcon} /> Case Overview
                </h2>
              </div>

              <div className={styles.caseInfo}>
                <div className={styles.infoGrid}>
                  <div className={styles.infoSection}>
                    <h3 className={styles.infoSectionTitle}>Case Information</h3>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Case ID:</span>
                      <span className={styles.infoValue}>#{caseData.id}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Title:</span>
                      <span className={styles.infoValue}>{caseData.title}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Case Type:</span>
                      <span className={styles.infoValue}>{caseData.case_type}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Filing Date:</span>
                      <span className={styles.infoValue}>
                        {caseData.filing_date ? new Date(caseData.filing_date).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Jurisdiction:</span>
                      <span className={styles.infoValue}>{caseData.jurisdiction}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Priority:</span>
                      <span className={`${styles.priorityBadge} ${styles[`priority${caseData.priority}`]}`}>
                        {caseData.priority}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoSection}>
                    <h3 className={styles.infoSectionTitle}>Legal Representation</h3>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Lawyer:</span>
                      <span className={styles.infoValue}>{caseData.lawyer_name}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Contact:</span>
                      <span className={styles.infoValue}>{caseData.lawyer_contact_info || "N/A"}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Plaintiff:</span>
                      <span className={styles.infoValue}>{caseData.plaintiff_name || "N/A"}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Opposing Party:</span>
                      <span className={styles.infoValue}>{caseData.defendant_name}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.infoSection}>
                  <h3 className={styles.infoSectionTitle}>Description</h3>
                  <p className={styles.caseDescription}>{caseData.description || "No description provided"}</p>
                </div>

                <div className={styles.hearingInfo}>
                  <div className={styles.hearingDate}>
                    <Calendar className={styles.iconSmall} />
                    <span>Next Hearing:</span>
                    <strong>
                      {caseData.next_hearing_date
                        ? new Date(caseData.next_hearing_date).toLocaleDateString()
                        : "Not scheduled"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Case Timeline Section */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  <Calendar className={styles.cardIcon} /> Case Timeline
                </h2>
              </div>

              {timelineEvents.length > 0 ? (
                <div className={styles.timelineContainer}>
                  {timelineEvents.map((event, index) => (
                    <div key={index} className={styles.timelineItem}>
                      <div className={styles.timelineDot}></div>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <span className={styles.timelineDate}>
                            <Clock className={styles.iconSmall} />
                            {new Date(event.event_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className={styles.timelineEvent}>{event.progress_event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <Calendar className={styles.emptyStateIcon} />
                  <p>No timeline events recorded yet</p>
                </div>
              )}
            </div>

            {/* Document Manager Section */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  <File className={styles.cardIcon} /> Documents
                </h2>
              </div>

              {documents.length > 0 ? (
                <div className={styles.documentList}>
                  <h3 className={styles.sectionTitle}>Case Documents</h3>
                  <div className={styles.documentGrid}>
                    {documents.map((doc) => (
                      <div key={doc.id} className={styles.documentCard}>
                        <div className={styles.documentIcon}>
                          <File className={styles.icon} />
                        </div>
                        <div className={styles.documentInfo}>
                          <p className={styles.documentName}>{doc.file_path}</p>
                          <p className={styles.documentDate}>{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        </div>
                        <div className={styles.documentActions}>
                          <a
                            href={`http://127.0.0.1:5000/court-files/${doc.file_path}`}
                            className={styles.iconButton}
                            title="Download"
                            download
                          >
                            <Download className={styles.iconSmall} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <File className={styles.emptyStateIcon} />
                  <p>No documents uploaded yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Side column - Evidence and communication */}
          <div className={styles.sideColumn}>
            {/* Evidence Manager Section */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  <File className={styles.cardIcon} /> Evidence
                </h2>
              </div>

              {evidenceList.length > 0 ? (
                <div className={styles.evidenceList}>
                  <h3 className={styles.sectionTitle}>Reviewed Evidence</h3>
                  {evidenceList.map((evidence) => (
                    <div key={evidence.id} className={styles.evidenceItem}>
                      <div className={styles.evidenceHeader}>
                        <div className={`${styles.evidenceStatus} ${styles.statusReviewed}`}>
                          <CheckCircle className={styles.iconSmall} /> Reviewed
                        </div>
                        {evidence.file_path && (
                          <a
                            href={`http://127.0.0.1:5000/evidence/${evidence.file_path}`}
                            className={styles.downloadLink}
                            download
                          >
                            <Download className={styles.iconSmall} /> Download
                          </a>
                        )}
                      </div>
                      <p className={styles.evidenceDescription}>{evidence.description || "No description"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <File className={styles.emptyStateIcon} />
                  <p>No reviewed evidence available</p>
                </div>
              )}
            </div>

            {/* Communication Section */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  <MessageSquare className={styles.cardIcon} /> Messages
                </h2>
              </div>

              <div className={styles.messagesSection}>
                <div className={styles.messageList}>
                  {messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`${styles.message} ${
                          msg.sender === "client" ? styles.sentMessage : styles.receivedMessage
                        }`}
                      >
                        <p>{msg.message}</p>
                        <span className={styles.messageTimestamp}>{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <MessageSquare className={styles.emptyStateIcon} />
                      <p>No messages yet</p>
                    </div>
                  )}
                </div>
                <div className={styles.messageInput}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className={styles.formInput}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <button onClick={handleSendMessage} className={styles.sendButton}>
                    <Send className={styles.iconSmall} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Notifications */}
      <div className={styles.notificationContainer}>
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`${styles.notification} ${styles[notification.type]}`}
            >
              {notification.type === "success" ? (
                <CheckCircle className={styles.notificationIcon} />
              ) : (
                <AlertCircle className={styles.notificationIcon} />
              )}
              <span>{notification.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className={styles.loaderOverlay}>
          <div className={styles.loader}></div>
        </div>
      )}
    </div>
  )
}

