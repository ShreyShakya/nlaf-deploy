"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  Sun,
  Moon,
  FileText,
  Clock,
  User,
  Settings,
  AlertCircle,
  CheckCircle,
  Menu,
  X,
  MoreVertical,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { Tooltip } from "react-tooltip";
import styles from "./ClientDashboard.module.css";
import io from "socket.io-client";
import { initiateVideoCall } from "../utils/videoCallUtils";

export default function ClientDashboard() {
  const [client, setClient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [notifications, setNotifications] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [formData, setFormData] = useState({});
  const [settingsFormData, setSettingsFormData] = useState({});
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedCaseForChat, setSelectedCaseForChat] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [socket, setSocket] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    document.body.className = theme === "dark" ? styles.darkTheme : "";
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const token = localStorage.getItem("clientToken");
    const clientData = localStorage.getItem("client");

    if (!token || !clientData) {
      addNotification("Please log in to access the dashboard", "error");
      navigate("/client-login");
      return;
    }

    const parsedClient = JSON.parse(clientData);
    setClient(parsedClient);
    setFormData(parsedClient);
    setSettingsFormData({
      email_notifications: parsedClient.email_notifications || false,
      preferred_contact: parsedClient.preferred_contact || "Email",
    });

    // Initialize Socket.IO with token
    const newSocket = io("http://127.0.0.1:5000", {
      query: { token, role: "client" },
      transports: ["websocket"],
    });
    setSocket(newSocket);

    // Join client's Socket.IO room
    newSocket.emit("join_client_room", { client_id: parsedClient.id });

    // Socket.IO event listeners
    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
    });

    newSocket.on("incoming_call", (data) => {
      setIncomingCall(data);
      addNotification(`Incoming call for appointment #${data.appointmentId}`, "success");
    });

    newSocket.on("call_error", (data) => {
      setIncomingCall(null);
      setCurrentCall(null);
      addNotification(data.message || "Failed to connect to the call. Please try again.", "error");
    });

    newSocket.on("new_message", (message) => {
      if (message.case_id === selectedCaseForChat?.id) {
        setChatMessages((prev) => [...prev, message]);
      }
    });

    newSocket.on("status", (data) => {
      console.log(data.message);
    });

    fetchData(token);

    // Cleanup on unmount
    return () => {
      newSocket.off("connect");
      newSocket.off("incoming_call");
      newSocket.off("call_error");
      newSocket.off("new_message");
      newSocket.off("status");
      if (selectedCaseForChat) {
        newSocket.emit("leave", { case_id: selectedCaseForChat.id });
      }
      newSocket.disconnect();
    };
  }, [navigate, selectedCaseForChat]);

  const fetchData = async (token) => {
    setLoading(true);
    setError("");
    try {
      const appointmentsResponse = await axios.get("http://127.0.0.1:5000/api/client-appointments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppointments(appointmentsResponse.data.appointments || []);

      try {
        const casesResponse = await axios.get("http://127.0.0.1:5000/api/client-cases", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCases(casesResponse.data.cases || []);
      } catch (caseErr) {
        addNotification("Failed to load cases. This feature may not be available yet.", "error");
        setCases([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch data.");
      addNotification(err.response?.data?.error || "Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (isChatOpen && selectedCaseForChat) {
      socket.emit("leave", { case_id: selectedCaseForChat.id });
      setSelectedCaseForChat(null);
      setChatMessages([]);
    }
  };

  const addNotification = (message, type = "success") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000);
  };

  const handleCaseSelectForChat = async (caseItem) => {
    setSelectedCaseForChat(caseItem);
    const token = localStorage.getItem("clientToken");

    socket.emit("join", { case_id: caseItem.id });

    try {
      const response = await axios.get(`http://127.0.0.1:5000/api/case/${caseItem.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChatMessages(response.data.messages);
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to load messages", "error");
      setChatMessages([]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedCaseForChat) return;

    const token = localStorage.getItem("clientToken");
    try {
      const response = await axios.post(
        `http://127.0.0.1:5000/api/case/${selectedCaseForChat.id}/messages`,
        { message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage("");
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to send message", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("clientToken");
    localStorage.removeItem("client");
    addNotification("Logged out successfully", "success");
    navigate("/client-login");
  };

  const handleAppointmentDetails = (appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleAnswerCall = () => {
    if (!incomingCall) {
      console.error("No incoming call data available");
      return;
    }

    const callWindow = window.open("", "_blank", "width=1200,height=800");
    if (!callWindow) {
      setIncomingCall(null);
      addNotification("Failed to open call window. Please allow pop-ups.", "error");
      console.error("Pop-up window blocked or failed to open");
      return;
    }

    // Set up the call window
    callWindow.document.title = "Video Consultation";
    callWindow.document.body.style.margin = "0";
    callWindow.document.body.style.padding = "0";
    callWindow.document.body.style.overflow = "hidden";

    // Create the Jitsi container
    const container = callWindow.document.createElement("div");
    container.id = "jitsi-container";
    container.style.width = "100%";
    container.style.height = "100vh";
    callWindow.document.body.appendChild(container);

    // Load the Jitsi script
    const script = callWindow.document.createElement("script");
    script.src = "https://8x8.vc/vpaas-magic-cookie-70206cd47ac84290b883e32da817bc72/external_api.js";
    script.async = true;

    script.onload = () => {
      try {
        console.log("Jitsi script loaded for client. Starting video call.");
        const api = initiateVideoCall(incomingCall.appointmentId, "client", callWindow, incomingCall.clientJwt);
        setCurrentCall(api);
        setIncomingCall(null);

        api.on("readyToClose", () => {
          console.log("Client video call ended");
          if (currentCall) {
            currentCall.dispose();
          }
          setCurrentCall(null);
          if (!callWindow.closed) {
            callWindow.close();
          }
        });
      } catch (err) {
        console.error("Video call init error (client):", err.message, err.stack);
        setIncomingCall(null);
        setCurrentCall(null);
        if (!callWindow.closed) {
          callWindow.close();
        }
        addNotification(`Failed to initialize video call: ${err.message}`, "error");
      }
    };

    script.onerror = () => {
      console.error("Failed to load Jitsi script");
      setIncomingCall(null);
      if (!callWindow.closed) {
        callWindow.close();
      }
      addNotification("Failed to load video call resources", "error");
    };

    callWindow.document.head.appendChild(script);
  };


  const handleDeclineCall = () => {
    setIncomingCall(null);
    addNotification("Call declined", "success");
  };

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettingsFormData({ ...settingsFormData, [name]: type === "checkbox" ? checked : value });
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePictureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, profile_picture: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("clientToken");
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      for (const key in formData) {
        if (key !== "profile_picture") formDataToSend.append(key, formData[key]);
      }
      if (profilePictureFile) formDataToSend.append("profile_picture", profilePictureFile);

      const response = await axios.put("http://127.0.0.1:5000/api/client-profile", formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setClient(response.data.client);
      localStorage.setItem("client", JSON.stringify(response.data.client));
      setIsEditingProfile(false);
      setProfilePictureFile(null);
      addNotification(response.data.message || "Profile updated successfully", "success");
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to update profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("clientToken");
    setLoading(true);
    try {
      const response = await axios.put("http://127.0.0.1:5000/api/client-profile", settingsFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setClient(response.data.client);
      localStorage.setItem("client", JSON.stringify(response.data.client));
      addNotification(response.data.message || "Settings updated successfully", "success");
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to update settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({ ...passwordData, [name]: value });
    setPasswordError("");
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("clientToken");

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
      setPasswordError("All fields are required");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      setPasswordError("New password and confirmation do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.put(
        "http://127.0.0.1:5000/api/client/change-password",
        {
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      setPasswordError("");
      addNotification(response.data.message || "Password updated successfully", "success");

      localStorage.removeItem("clientToken");
      localStorage.removeItem("client");
      navigate("/client-login");
    } catch (err) {
      setPasswordError(err.response?.data?.error || "Failed to update password");
      addNotification(err.response?.data?.error || "Failed to update password", "error");
    } finally {
      setLoading(false);
    }
  };

  const upcomingAppointments = appointments
    .filter((appt) => new Date(appt.appointment_date) >= new Date() && appt.status !== "cancelled")
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
    .slice(0, 3);

  const recentCases = cases.slice(0, 3);

  if (!client) {
    return (
      <div className={`${styles.dashboardPage} ${theme === "dark" ? styles.darkTheme : ""}`}>
        <div className={styles.loaderContainer}>
          <div className={styles.loader}></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.dashboardPage} ${theme === "dark" ? styles.darkTheme : ""}`}>
      <Tooltip id="theme-tooltip" />
      <Tooltip id="logout-tooltip" />
      <Tooltip id="details-tooltip" />
      <Tooltip id="edit-tooltip" />
      <Tooltip id="chat-tooltip" />

      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}>
          <div className={styles.sidebarHeader}>
            <button className={styles.menuButton} onClick={toggleSidebar}>
              {isSidebarOpen ? <X className={styles.icon} /> : <Menu className={styles.icon} />}
            </button>
            <button onClick={() => navigate("/")} className={styles.logoLink}>
              <Scale className={styles.logoIcon} />
              <span>NepaliLegalAidFinder</span>
            </button>
          </div>

          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              <img
                src={
                  client.profile_picture
                    ? `http://127.0.0.1:5000${client.profile_picture}`
                    : "https://via.placeholder.com/100"
                }
                alt={client.name}
              />
            </div>
            <div className={styles.userName}>{client.name}</div>
            <div className={styles.userRole}>Client</div>
          </div>

          <nav className={styles.sidebarNav}>
            <button
              onClick={() => {
                setActiveTab("dashboard");
                setIsSidebarOpen(false);
              }}
              className={`${styles.navLink} ${activeTab === "dashboard" ? styles.activeNavLink : ""}`}
            >
              <FileText className={styles.navIcon} />
              <span>Dashboard</span>
              {activeTab === "dashboard" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => {
                setActiveTab("appointments");
                setIsSidebarOpen(false);
              }}
              className={`${styles.navLink} ${activeTab === "appointments" ? styles.activeNavLink : ""}`}
            >
              <Clock className={styles.navIcon} />
              <span>Appointments</span>
              {activeTab === "appointments" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => {
                setActiveTab("cases");
                setIsSidebarOpen(false);
              }}
              className={`${styles.navLink} ${activeTab === "cases" ? styles.activeNavLink : ""}`}
            >
              <FileText className={styles.navIcon} />
              <span>Cases</span>
              {activeTab === "cases" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => {
                setActiveTab("profile");
                setIsSidebarOpen(false);
              }}
              className={`${styles.navLink} ${activeTab === "profile" ? styles.activeNavLink : ""}`}
            >
              <User className={styles.navIcon} />
              <span>Profile</span>
              {activeTab === "profile" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => {
                setActiveTab("settings");
                setIsSidebarOpen(false);
              }}
              className={`${styles.navLink} ${activeTab === "settings" ? styles.activeNavLink : ""}`}
            >
              <Settings className={styles.navIcon} />
              <span>Settings</span>
              {activeTab === "settings" && <ChevronRight className={styles.activeIcon} />}
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
              {activeTab === "dashboard" && "Dashboard"}
              {activeTab === "appointments" && "Appointments"}
              {activeTab === "cases" && "Cases"}
              {activeTab === "profile" && "Profile"}
              {activeTab === "settings" && "Settings"}
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
              <button
                onClick={handleLogout}
                className={styles.logoutButton}
                data-tooltip-id="logout-tooltip"
                data-tooltip-content="Log out of your account"
              >
                Logout
              </button>
            </div>
          </div>

          <div className={styles.dashboardContent}>
            {activeTab === "dashboard" && (
              <div className={styles.dashboardGrid}>
                <div className={styles.welcomeCard}>
                  <div className={styles.welcomeContent}>
                    <h2>Welcome back, {client.name}</h2>
                    <p>Manage your legal needs efficiently with NepaliLegalAidFinder.</p>
                    <button onClick={() => navigate("/browse-lawyers")} className={styles.primaryButton}>
                      Browse Lawyers
                    </button>
                  </div>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Upcoming Appointments</h2>
                    <button onClick={() => setActiveTab("appointments")} className={styles.viewAllButton}>
                      View All
                    </button>
                  </div>
                  {loading ? (
                    <div className={styles.loadingState}>
                      <div className={styles.miniLoader}></div>
                      <p>Loading appointments...</p>
                    </div>
                  ) : error ? (
                    <div className={styles.errorState}>
                      <AlertCircle className={styles.errorIcon} />
                      <p>{error}</p>
                    </div>
                  ) : upcomingAppointments.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>No upcoming appointments.</p>
                      <button onClick={() => navigate("/browse-lawyers")} className={styles.secondaryButton}>
                        Schedule an Appointment
                      </button>
                    </div>
                  ) : (
                    <div className={styles.tableWrapper}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Lawyer Name</th>
                            <th>Date & Time</th>
                            <th>Status</th>
                            <th>Booked On</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingAppointments.map((appt) => (
                            <tr key={appt.id}>
                              <td className={styles.primaryCell}>{appt.lawyer_name}</td>
                              <td>
                                {new Date(appt.appointment_date).toLocaleString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td>
                                <span
                                  className={`${styles.statusBadge} ${styles[`status${appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}`]}`}
                                >
                                  {appt.status}
                                </span>
                              </td>
                              <td>
                                {new Date(appt.created_at).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td>
                                <button
                                  onClick={() => handleAppointmentDetails(appt)}
                                  className={styles.iconButton}
                                  data-tooltip-id="details-tooltip"
                                  data-tooltip-content="View appointment details"
                                >
                                  <MoreVertical className={styles.buttonIcon} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Recent Cases</h2>
                    <button onClick={() => setActiveTab("cases")} className={styles.viewAllButton}>
                      View All
                    </button>
                  </div>
                  {loading ? (
                    <div className={styles.loadingState}>
                      <div className={styles.miniLoader}></div>
                      <p>Loading cases...</p>
                    </div>
                  ) : cases.length > 0 ? (
                    <div className={styles.tableWrapper}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Case Info</th>
                            <th>Case No</th>
                            <th>Status</th>
                            <th>Created At</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentCases.map((caseItem) => (
                            <tr key={caseItem.id}>
                              <td className={styles.primaryCell}>
                                <div className={styles.caseInfo}>
                                  <div className={styles.caseTitle}>{caseItem.title}</div>
                                  <div className={styles.caseDescription}>
                                    {caseItem.description || "No description"}
                                  </div>
                                </div>
                              </td>
                              <td>#{caseItem.id}</td>
                              <td>
                                <span
                                  className={`${styles.statusBadge} ${styles[`status${caseItem.status.charAt(0).toUpperCase() + caseItem.status.slice(1)}`]}`}
                                >
                                  {caseItem.status}
                                </span>
                              </td>
                              <td>
                                {new Date(caseItem.created_at).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td>
                                <button
                                  onClick={() => navigate(`/client-case/${caseItem.id}`)}
                                  className={styles.iconButton}
                                  data-tooltip-id="details-tooltip"
                                  data-tooltip-content="View case details"
                                >
                                  <MoreVertical className={styles.buttonIcon} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <p>No cases available. Feature coming soon.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "appointments" && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>All Appointments</h2>
                  <button onClick={() => navigate("/browse-lawyers")} className={styles.primaryButton}>
                    Schedule New
                  </button>
                </div>
                {loading ? (
                  <div className={styles.loadingState}>
                    <div className={styles.miniLoader}></div>
                    <p>Loading appointments...</p>
                  </div>
                ) : error ? (
                  <div className={styles.errorState}>
                    <AlertCircle className={styles.errorIcon} />
                    <p>{error}</p>
                  </div>
                ) : appointments.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>You have no appointments scheduled.</p>
                    <button onClick={() => navigate("/browse-lawyers")} className={styles.secondaryButton}>
                      Schedule an Appointment
                    </button>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Lawyer Name</th>
                          <th>Date & Time</th>
                          <th>Status</th>
                          <th>Booked On</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((appt) => (
                          <tr key={appt.id}>
                            <td className={styles.primaryCell}>{appt.lawyer_name}</td>
                            <td>
                              {new Date(appt.appointment_date).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td>
                              <span
                                className={`${styles.statusBadge} ${styles[`status${appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}`]}`}
                              >
                                {appt.status}
                              </span>
                            </td>
                            <td>
                              {new Date(appt.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td>
                              <button
                                onClick={() => handleAppointmentDetails(appt)}
                                className={styles.iconButton}
                                data-tooltip-id="details-tooltip"
                                data-tooltip-content="View appointment details"
                              >
                                <MoreVertical className={styles.buttonIcon} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "cases" && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>All Cases</h2>
                </div>
                {loading ? (
                  <div className={styles.loadingState}>
                    <div className={styles.miniLoader}></div>
                    <p>Loading cases...</p>
                  </div>
                ) : cases.length > 0 ? (
                  <div className={styles.tableWrapper}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Case Info</th>
                          <th>Case No</th>
                          <th>Status</th>
                          <th>Created At</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cases.map((caseItem) => (
                          <tr key={caseItem.id}>
                            <td className={styles.primaryCell}>
                              <div className={styles.caseInfo}>
                                <div className={styles.caseTitle}>{caseItem.title}</div>
                                <div className={styles.caseDescription}>{caseItem.description || "No description"}</div>
                              </div>
                            </td>
                            <td>#{caseItem.id}</td>
                            <td>
                              <span
                                className={`${styles.statusBadge} ${styles[`status${caseItem.status.charAt(0).toUpperCase() + caseItem.status.slice(1)}`]}`}
                              >
                                {caseItem.status}
                              </span>
                            </td>
                            <td>
                              {new Date(caseItem.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td>
                              <button
                                onClick={() => navigate(`/client-case/${caseItem.id}`)}
                                className={styles.iconButton}
                                data-tooltip-id="details-tooltip"
                                data-tooltip-content="View case details"
                              >
                                <MoreVertical className={styles.buttonIcon} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <p>No cases available.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "profile" && (
              <div className={styles.profileCard}>
                {isEditingProfile ? (
                  <form onSubmit={handleProfileSave} className={styles.editForm}>
                    <div className={styles.formHeader}>
                      <h2 className={styles.formTitle}>Edit Profile</h2>
                    </div>

                    <div className={styles.profilePictureSection}>
                      <img
                        src={formData.profile_picture || "https://via.placeholder.com/100"}
                        alt="Profile"
                        className={styles.profilePicture}
                      />
                      <label htmlFor="profilePictureUpload" className={styles.uploadButton}>
                        Change Photo
                        <input
                          id="profilePictureUpload"
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePictureChange}
                          className={styles.fileInput}
                        />
                      </label>
                    </div>

                    <div className={styles.formGrid}>
                      <div className={styles.formGroup}>
                        <label>Email:</label>
                        <input type="email" name="email" value={formData.email} className={styles.formInput} disabled />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Phone:</label>
                        <input
                          type="text"
                          name="phone"
                          value={formData.phone || ""}
                          onChange={handleProfileChange}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Address:</label>
                        <input
                          type="text"
                          name="address"
                          value={formData.address || ""}
                          onChange={handleProfileChange}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup + " " + styles.fullWidth}>
                        <label>Bio:</label>
                        <textarea
                          name="bio"
                          value={formData.bio || ""}
                          onChange={handleProfileChange}
                          className={styles.formTextarea}
                        />
                      </div>
                    </div>

                    <div className={styles.formActions}>
                      <button type="submit" className={styles.primaryButton} disabled={loading}>
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(false)}
                        className={styles.secondaryButton}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.profileView}>
                    <div className={styles.profileHeader}>
                      <div className={styles.profileImageContainer}>
                        <img
                          src={
                            client.profile_picture
                              ? `http://127.0.0.1:5000${client.profile_picture}`
                              : "https://via.placeholder.com/100"
                          }
                          alt="Profile"
                          className={styles.profileImage}
                        />
                      </div>
                      <div className={styles.profileInfo}>
                        <h2 className={styles.profileName}>{client.name}</h2>
                        <p className={styles.profileRole}>Client</p>
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className={styles.editProfileButton}
                          data-tooltip-id="edit-tooltip"
                          data-tooltip-content="Edit your profile details"
                        >
                          Edit Profile
                        </button>
                      </div>
                    </div>

                    <div className={styles.profileDetailsCard}>
                      <h3 className={styles.detailsTitle}>Contact Information</h3>
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Email</div>
                          <div className={styles.detailValue}>{client.email}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Phone</div>
                          <div className={styles.detailValue}>{client.phone || "Not provided"}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Address</div>
                          <div className={styles.detailValue}>{client.address || "Not provided"}</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.profileDetailsCard}>
                      <h3 className={styles.detailsTitle}>About</h3>
                      <p className={styles.bioText}>{client.bio || "No bio information provided."}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div className={styles.settingsContainer}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Notification Settings</h2>
                  </div>
                  <form onSubmit={handleSettingsSave} className={styles.settingsForm}>
                    <div className={styles.settingsGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          name="email_notifications"
                          checked={settingsFormData.email_notifications}
                          onChange={handleSettingsChange}
                          className={styles.checkbox}
                        />
                        <span>Email Notifications</span>
                      </label>
                      <p className={styles.settingsDescription}>
                        Receive email notifications about appointments, case updates, and more.
                      </p>
                    </div>
                    <div className={styles.settingsGroup}>
                      <label>Preferred Contact Method:</label>
                      <select
                        name="preferred_contact"
                        value={settingsFormData.preferred_contact}
                        onChange={handleSettingsChange}
                        className={styles.formSelect}
                      >
                        <option value="Email">Email</option>
                        <option value="Phone">Phone</option>
                      </select>
                    </div>
                    <div className={styles.formActions}>
                      <button type="submit" className={styles.primaryButton} disabled={loading}>
                        Save Settings
                      </button>
                    </div>
                  </form>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Change Password</h2>
                  </div>
                  <form onSubmit={handlePasswordUpdate} className={styles.passwordForm}>
                    <div className={styles.formGroup}>
                      <label htmlFor="currentPassword">Current Password</label>
                      <input
                        type="password"
                        id="currentPassword"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className={styles.formInput}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="newPassword">New Password</label>
                      <input
                        type="password"
                        id="newPassword"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className={styles.formInput}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="confirmNewPassword">Confirm New Password</label>
                      <input
                        type="password"
                        id="confirmNewPassword"
                        name="confirmNewPassword"
                        value={passwordData.confirmNewPassword}
                        onChange={handlePasswordChange}
                        className={styles.formInput}
                        required
                        disabled={loading}
                      />
                    </div>
                    {passwordError && (
                      <div className={styles.errorMessage}>
                        <AlertCircle className={styles.errorIcon} />
                        {passwordError}
                      </div>
                    )}
                    <div className={styles.formActions}>
                      <button type="submit" className={styles.primaryButton} disabled={loading}>
                        Update Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmNewPassword: "",
                          });
                          setPasswordError("");
                        }}
                        className={styles.secondaryButton}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {selectedAppointment && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <div className={styles.modalHeader}>
                <h3>Appointment Details</h3>
                <button onClick={() => setSelectedAppointment(null)} className={styles.closeButton}>
                  <X className={styles.closeIcon} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.appointmentDetail}>
                  <div className={styles.detailLabel}>Lawyer Name</div>
                  <div className={styles.detailValue}>{selectedAppointment.lawyer_name}</div>
                </div>
                <div className={styles.appointmentDetail}>
                  <div className={styles.detailLabel}>Specialization</div>
                  <div className={styles.detailValue}>{selectedAppointment.specialization}</div>
                </div>
                <div className={styles.appointmentDetail}>
                  <div className={styles.detailLabel}>Date & Time</div>
                  <div className={styles.detailValue}>
                    {new Date(selectedAppointment.appointment_date).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className={styles.appointmentDetail}>
                  <div className={styles.detailLabel}>Status</div>
                  <div className={styles.detailValue}>
                    <span
                      className={`${styles.statusBadge} ${styles[`status${selectedAppointment.status.charAt(0).toUpperCase() + selectedAppointment.status.slice(1)}`]}`}
                    >
                      {selectedAppointment.status}
                    </span>
                  </div>
                </div>
                <div className={styles.appointmentDetail}>
                  <div className={styles.detailLabel}>Booked On</div>
                  <div className={styles.detailValue}>
                    {new Date(selectedAppointment.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button onClick={() => setSelectedAppointment(null)} className={styles.secondaryButton}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={toggleChat}
        className={styles.chatButton}
        data-tooltip-id="chat-tooltip"
        data-tooltip-content="Open chat"
      >
        <MessageCircle className={styles.chatIcon} />
      </button>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            className={styles.chatModal}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.chatHeader}>
              <h3>Chat</h3>
              <button onClick={toggleChat} className={styles.closeButton}>
                <X className={styles.closeIcon} />
              </button>
            </div>
            <div className={styles.chatBody}>
              {!selectedCaseForChat ? (
                <div className={styles.caseSelection}>
                  <h4>Select a Case to Chat About</h4>
                  {cases.length > 0 ? (
                    <ul className={styles.caseList}>
                      {cases.map((caseItem) => (
                        <li
                          key={caseItem.id}
                          onClick={() => handleCaseSelectForChat(caseItem)}
                          className={styles.caseItem}
                        >
                          {caseItem.title} (#{caseItem.id})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No cases available to chat about.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.chatConversation}>
                    <h4>Chat for Case: {selectedCaseForChat.title}</h4>
                    <div className={styles.messagesContainer}>
                      {chatMessages.length > 0 ? (
                        chatMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`${styles.chatMessage} ${message.sender === "client" ? styles.chatMessageSent : styles.chatMessageReceived
                              }`}
                          >
                            <div className={styles.messageBubble}>
                              <p>{message.message}</p>
                              <span className={styles.messageTimestamp}>
                                {new Date(message.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className={styles.chatEmpty}>
                          <MessageCircle className={styles.chatEmptyIcon} />
                          <p>No messages yet. Start a conversation!</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <form onSubmit={handleSendMessage} className={styles.chatInputForm}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className={styles.chatInput}
                    />
                    <button type="submit" className={styles.sendButton}>
                      Send
                    </button>
                  </form>
                  <button
                    onClick={() => {
                      socket.emit("leave", { case_id: selectedCaseForChat.id });
                      setSelectedCaseForChat(null);
                      setChatMessages([]);
                    }}
                    className={styles.backButton}
                  >
                    Back to Cases
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.notificationContainer}>
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              className={`${styles.notification} ${notification.type === "error" ? styles.errorNotification : styles.successNotification
                }`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              {notification.type === "success" ? (
                <CheckCircle className={styles.notificationIcon} />
              ) : (
                <AlertCircle className={styles.notificationIcon} />
              )}
              {notification.message}
            </motion.div>
          ))}

          {incomingCall && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={styles.modalContent}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <div className={styles.modalHeader}>
                  <h3>Incoming Video Call</h3>
                </div>
                <div className={styles.modalBody}>
                  <p>Your lawyer is calling you for appointment #{incomingCall.appointmentId}</p>
                </div>
                <div className={styles.modalFooter}>
                  <button onClick={handleAnswerCall} className={styles.primaryButton}>
                    Answer
                  </button>
                  <button onClick={handleDeclineCall} className={styles.secondaryButton}>
                    Decline
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.loaderOverlay} style={{ display: loading ? "flex" : "none" }}>
        <div className={styles.loader}></div>
      </div>
    </div>
  );
}