import { useState, useEffect } from "react";
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
  BarChart2,
  ChevronRight,
  Briefcase,
  MessageCircle,
} from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "react-tooltip";
import styles from "./LawyerDashboard.module.css";
import io from "socket.io-client";
import { initiateVideoCall } from '../utils/videoCallUtils';

export default function LawyerDashboard() {
  const [lawyer, setLawyer] = useState(null);
  const [cases, setCases] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [formData, setFormData] = useState({});
  const [settingsFormData, setSettingsFormData] = useState({});
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [dialog, setDialog] = useState({ isOpen: false, message: "", onConfirm: null });
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [newCaseData, setNewCaseData] = useState({
    client_id: "",
    title: "",
    case_type: "Civil",
    status: "pending",
    filing_date: new Date().toISOString().split("T")[0],
    jurisdiction: "District Court",
    description: "",
    plaintiff_name: "",
    defendant_name: "",
    priority: "Medium",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientCases, setClientCases] = useState([]);
  const [selectedCaseForChat, setSelectedCaseForChat] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [isKycFormOpen, setIsKycFormOpen] = useState(false);
  const [kycFormData, setKycFormData] = useState({
    license_number: "",
    contact_number: "",
  });
  const [kycDocumentFile, setKycDocumentFile] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    document.body.className = theme === "dark" ? styles.darkTheme : "";
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      addNotification("Please log in to access the dashboard", "error");
      navigate("/lawyer-login");
      return;
    }

    // Initialize SocketIO connection
    const newSocket = io("http://127.0.0.1:5000", {
      query: { token },
      transports: ["websocket"],
    });
    setSocket(newSocket);

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const profileResponse = await axios.get("http://127.0.0.1:5000/api/lawyer-profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLawyer(profileResponse.data.lawyer);
        setFormData(profileResponse.data.lawyer);
        setSettingsFormData({
          email_notifications: profileResponse.data.lawyer.email_notifications,
          preferred_contact: profileResponse.data.lawyer.preferred_contact,
        });

        const casesResponse = await axios.get("http://127.0.0.1:5000/api/lawyer-cases", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCases(casesResponse.data.cases);

        try {
          const appointmentsResponse = await axios.get(
            `http://127.0.0.1:5000/api/lawyer-appointments/${profileResponse.data.lawyer.id}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          setAppointments(appointmentsResponse.data.appointments || []);
        } catch (apptErr) {
          addNotification("Failed to load appointments. This feature may not be available yet.", "error");
          setAppointments([]);
        }

        try {
          const clientsResponse = await axios.get("http://127.0.0.1:5000/api/lawyer-clients", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setClients(clientsResponse.data.clients || []);
        } catch (clientErr) {
          addNotification("Failed to load clients. You may not be able to create cases.", "error");
          setClients([]);
        }
      } catch (err) {
        console.log("Error:", err.response?.data?.error || err.message);
        addNotification(err.response?.data?.error || "Failed to load data", "error");
        localStorage.removeItem("token");
        localStorage.removeItem("lawyer");
        navigate("/lawyer-login");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    // SocketIO event listeners

    // SocketIO event listeners
    newSocket.on("kyc_status_updated", async (data) => {
      const token = localStorage.getItem("token");
      try {
        const profileResponse = await axios.get("http://127.0.0.1:5000/api/lawyer-profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLawyer(profileResponse.data.lawyer);
        addNotification(`KYC Status Updated: ${data.kyc_status}`, "success");
      } catch (err) {
        addNotification("Failed to refresh profile after KYC update", "error");
      }
    });

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
    });

    newSocket.on("new_message", (message) => {
      if (message.case_id === selectedCaseForChat?.id) {
        setChatMessages((prev) => [...prev, message]);
      }
    });

    newSocket.on("status", (data) => {
      console.log(data.message);
    });

    newSocket.on("call_error", (data) => {
      setIsCalling(false);
      setCurrentCall(null);
      setDialog({ isOpen: false, message: "", onConfirm: null });
      addNotification(data.message || "Failed to connect to the client. Please try again.", "error");
    });

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
    });

    newSocket.on("new_message", (message) => {
      if (message.case_id === selectedCaseForChat?.id) {
        setChatMessages((prev) => [...prev, message]);
      }
    });

    newSocket.on("status", (data) => {
      console.log(data.message);
    });

    // Cleanup on unmount
    return () => {
      newSocket.off("connect");
      newSocket.off("new_message");
      newSocket.off("status");
      newSocket.off("call_error");
      if (selectedCaseForChat) {
        newSocket.emit("leave", { case_id: selectedCaseForChat.id });
      }
      newSocket.disconnect();
    };
  }, [navigate, selectedCaseForChat]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (isChatOpen) {
      if (selectedCaseForChat) {
        socket.emit("leave", { case_id: selectedCaseForChat.id });
      }
      setSelectedClient(null);
      setClientCases([]);
      setSelectedCaseForChat(null);
      setChatMessages([]);
    }
  };

  const addNotification = (message, type = "success") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000);
  };

  const handleKycFormChange = (e) => {
    const { name, value } = e.target;
    setKycFormData({ ...kycFormData, [name]: value });
  };

  const handleKycDocumentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setKycDocumentFile(file);
    }
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!kycFormData.license_number || !kycFormData.contact_number || !kycDocumentFile) {
      addNotification("All KYC fields are required", "error");
      return;
    }

    setIsLoading(true);
    try {
      const kycDataToSend = new FormData();
      kycDataToSend.append("license_number", kycFormData.license_number);
      kycDataToSend.append("contact_number", kycFormData.contact_number);
      kycDataToSend.append("identification_document", kycDocumentFile);

      const response = await axios.post("http://127.0.0.1:5000/api/lawyer-kyc", kycDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const profileResponse = await axios.get("http://127.0.0.1:5000/api/lawyer-profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLawyer(profileResponse.data.lawyer);
      setIsKycFormOpen(false);
      setKycFormData({ license_number: "", contact_number: "" });
      setKycDocumentFile(null);
      addNotification(response.data.message || "KYC submitted successfully", "success");
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to submit KYC", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientSelect = async (client) => {
    setSelectedClient(client);
    setSelectedCaseForChat(null);
    setChatMessages([]);
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(
        `http://127.0.0.1:5000/api/lawyer-client-cases/${client.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setClientCases(response.data.cases);
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to load client cases", "error");
      setClientCases([]);
    }
  };

  const handleCaseSelectForChat = async (caseItem) => {
    setSelectedCaseForChat(caseItem);
    const token = localStorage.getItem("token");

    socket.emit("join", { case_id: caseItem.id });

    try {
      const response = await axios.get(
        `http://127.0.0.1:5000/api/case/${caseItem.id}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setChatMessages(response.data.messages);
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to load messages", "error");
      setChatMessages([]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedCaseForChat) return;

    const token = localStorage.getItem("token");
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
    setDialog({
      isOpen: true,
      message: "Are you sure you want to logout?",
      onConfirm: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("lawyer");
        addNotification("Logged out successfully", "success");
        navigate("/lawyer-login");
      },
    });
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
    const token = localStorage.getItem("token");
    setIsLoading(true);
    try {
      const formDataToSend = new FormData();
      for (const key in formData) {
        if (key !== "profile_picture") formDataToSend.append(key, formData[key]);
      }
      if (profilePictureFile) formDataToSend.append("profile_picture", profilePictureFile);

      const response = await axios.put("http://127.0.0.1:5000/api/lawyer-profile", formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setLawyer(response.data.lawyer);
      localStorage.setItem("lawyer", JSON.stringify(response.data.lawyer));
      setIsEditingProfile(false);
      setProfilePictureFile(null);
      addNotification(response.data.message || "Profile updated successfully", "success");
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to update profile", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    setIsLoading(true);
    try {
      const response = await axios.put("http://127.0.0.1:5000/api/lawyer-profile", settingsFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setLawyer(response.data.lawyer);
      localStorage.setItem("lawyer", JSON.stringify(response.data.lawyer));
      addNotification(response.data.message || "Settings updated successfully", "success");
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to update settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({ ...passwordData, [name]: value });
    setPasswordError("");
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

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

    setIsLoading(true);
    try {
      const response = await axios.put(
        "http://127.0.0.1:5000/api/lawyer/change-password",
        {
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      setPasswordError("");
      addNotification(response.data.message || "Password updated successfully", "success");

      setDialog({
        isOpen: true,
        message: "Password changed successfully. You will be logged out. Please log in again with your new password.",
        onConfirm: () => {
          localStorage.removeItem("token");
          localStorage.removeItem("lawyer");
          navigate("/lawyer-login");
        },
      });
    } catch (err) {
      setPasswordError(err.response?.data?.error || "Failed to update password");
      addNotification(err.response?.data?.error || "Failed to update password", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaseDetails = (caseItem) => {
    navigate(`/case-details/${caseItem.id}`);
  };

  const handleAppointmentDetails = (appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleStatusChange = async (caseId, newStatus) => {
    const token = localStorage.getItem("token");
    setIsLoading(true);
    try {
      const response = await axios.put(
        `http://127.0.0.1:5000/api/lawyer-case/${caseId}/update-status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const casesResponse = await axios.get("http://127.0.0.1:5000/api/lawyer-cases", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCases(casesResponse.data.cases);
      addNotification(response.data.message || "Case status updated successfully", "success");
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to update case status", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAppointmentStatus = async (appointmentId, newStatus) => {
    const token = localStorage.getItem("token");
    setIsLoading(true);
    try {
      const response = await axios.put(
        `http://127.0.0.1:5000/api/update-appointment-status/${appointmentId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const appointmentsResponse = await axios.get(`http://127.0.0.1:5000/api/lawyer-appointments/${lawyer.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppointments(appointmentsResponse.data.appointments || []);
      addNotification(response.data.message || `Appointment ${newStatus} successfully`, "success");
    } catch (err) {
      addNotification(err.response?.data?.error || `Failed to ${newStatus} appointment`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCall = async (appointment) => {
    setIsCalling(true);
    let callWindow;

    try {
      const token = localStorage.getItem("lawyerToken");
      const response = await axios.post(
        "http://127.0.0.1:5000/api/get-jaas-jwt",
        {
          appointment_id: appointment.id,
          user_type: "lawyer",
          user_name: lawyer.name || "Lawyer",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const { jwt } = response.data;

      // Open call window
      callWindow = window.open("", "_blank", "width=1200,height=800");
      if (!callWindow) {
        throw new Error("Failed to open popup window. Allow pop-ups in your browser.");
      }

      callWindow.document.title = "Video Consultation";
      callWindow.document.body.style.margin = "0";
      callWindow.document.body.style.padding = "0";
      callWindow.document.body.style.overflow = "hidden";

      const container = callWindow.document.createElement("div");
      container.id = "jitsi-container";
      container.style.width = "100%";
      container.style.height = "100vh";
      callWindow.document.body.appendChild(container);

      // Dynamically load Jitsi script into the popup
      const script = callWindow.document.createElement("script");
      script.src = "https://8x8.vc/vpaas-magic-cookie-70206cd47ac84290b883e32da817bc72/external_api.js";
      script.async = true;

      script.onload = () => {
        console.log("Jitsi script loaded in popup.");
        const api = initiateVideoCall(appointment.id, "lawyer", callWindow, jwt);
        setCurrentCall(api);

        socket.emit("initiate_call", {
          appointment_id: appointment.id,
          client_id: appointment.client_id,
          lawyer_name: lawyer.name,
        });

        api.on("errorOccurred", async (error) => {
          console.error("Jitsi error details:", JSON.stringify(error, null, 2));
          if (error.name === "connection.passwordRequired" && error.message.includes("expired")) {
            console.log("JWT expired, attempting to fetch a new one...");
            try {
              const token = localStorage.getItem("lawyerToken");
              const response = await axios.post(
                "http://127.0.0.1:5000/api/get-jaas-jwt",
                {
                  appointment_id: appointment.id,
                  user_type: "lawyer",
                  user_name: lawyer.name || "Lawyer",
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const newJwt = response.data.jwt;
              api.dispose(); // Dispose of the old API instance
              const newApi = initiateVideoCall(appointment.id, "lawyer", callWindow, newJwt);
              setCurrentCall(newApi);
            } catch (retryErr) {
              console.error("Failed to retry with new JWT:", retryErr.message);
              addNotification("Failed to reconnect video call: Token refresh failed", "error");
              setIsCalling(false);
              if (!callWindow.closed) callWindow.close();
            }
          } else {
            throw new Error(`Jitsi error: ${JSON.stringify(error)}`);
          }
        });

        api.on("readyToClose", () => {
          console.log("Lawyer video call ended");
          api.dispose();
          setCurrentCall(null);
          setIsCalling(false);
          if (!callWindow.closed) {
            callWindow.close();
          }
        });
      };

      script.onerror = () => {
        throw new Error("Failed to load Jitsi script in popup window.");
      };

      callWindow.document.head.appendChild(script);
    } catch (err) {
      console.error("handleStartCall error:", err.message, err.stack);
      setIsCalling(false);
      setDialog({ isOpen: false, message: "", onConfirm: null });
      if (callWindow && !callWindow.closed) {
        callWindow.close();
      }
      addNotification(`Failed to initialize video call: ${err.message}`, "error");
    }
  };


  const handleNewCaseChange = (e) => {
    const { name, value } = e.target;
    setNewCaseData({ ...newCaseData, [name]: value });
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    setIsLoading(true);
    try {
      const response = await axios.post("http://127.0.0.1:5000/api/create-case", newCaseData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const casesResponse = await axios.get("http://127.0.0.1:5000/api/lawyer-cases", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCases(casesResponse.data.cases);
      setIsCreatingCase(false);
      setNewCaseData({
        client_id: "",
        title: "",
        case_type: "Civil",
        status: "pending",
        filing_date: new Date().toISOString().split("T")[0],
        jurisdiction: "District Court",
        description: "",
        plaintiff_name: "",
        defendant_name: "",
        priority: "Medium",
      });
      addNotification(response.data.message || "Case created successfully", "success");
    } catch (err) {
      addNotification(err.response?.data?.error || "Failed to create case", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const totalCases = cases.length;
  const pendingCases = cases.filter((c) => c.status === "pending").length;
  const highPriorityCases = cases.filter((c) => c.priority === "High").length;
  const completedCases = cases.filter((c) => c.status === "completed").length;

  const recentCases = cases.slice(0, 3);

  const upcomingAppointments = appointments
    .filter((appt) => new Date(appt.appointment_date) >= new Date() && appt.status !== "cancelled")
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
    .slice(0, 3);

  if (!lawyer) {
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
      <Tooltip id="edit-tooltip" />
      <Tooltip id="details-tooltip" />
      <Tooltip id="create-case-tooltip" />
      <Tooltip id="chat-tooltip" />
      <Tooltip id="kyc-tooltip" />

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
                  lawyer.profile_picture
                    ? `http://127.0.0.1:5000${lawyer.profile_picture}`
                    : "https://via.placeholder.com/100"
                }
                alt={lawyer.name}
              />
            </div>
            <div className={styles.userName}>
              {lawyer.name || "Lawyer Name"}
              <span
                className={`${styles.kycBadge} ${lawyer.kyc_verified ? styles.kycVerified : styles.kycUnverified}`}
              >
                {lawyer.kyc_verified ? "Verified" : "Unverified"}
              </span>
            </div>
            <div className={styles.userStatus}>
              <span
                className={`${styles.statusIndicator} ${lawyer.availability_status === "Available" ? styles.statusAvailable : styles.statusBusy}`}
              ></span>
              {lawyer.availability_status || "Available"}
            </div>
          </div>

          <nav className={styles.sidebarNav}>
            <button
              onClick={() => {
                setActiveTab("dashboard");
                setIsSidebarOpen(false);
              }}
              className={`${styles.navLink} ${activeTab === "dashboard" ? styles.activeNavLink : ""}`}
            >
              <BarChart2 className={styles.navIcon} />
              <span>Dashboard</span>
              {activeTab === "dashboard" && <ChevronRight className={styles.activeIcon} />}
            </button>
            <button
              onClick={() => {
                setActiveTab("cases");
                setIsSidebarOpen(false);
              }}
              className={`${styles.navLink} ${activeTab === "cases" ? styles.activeNavLink : ""}`}
            >
              <Briefcase className={styles.navIcon} />
              <span>Cases</span>
              {activeTab === "cases" && <ChevronRight className={styles.activeIcon} />}
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
              {activeTab === "cases" && "Case Management"}
              {activeTab === "appointments" && "Appointments"}
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
                    <h2>Welcome back, {lawyer.name}</h2>
                    <p>Manage your legal practice efficiently with NepaliLegalAidFinder.</p>
                    {!lawyer.kyc_verified && (
                      <button
                        onClick={() => setIsKycFormOpen(true)}
                        className={styles.secondaryButton}
                        data-tooltip-id="kyc-tooltip"
                        data-tooltip-content="Submit KYC for verification"
                      >
                        Submit KYC Verification
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.statsContainer}>
                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <Briefcase className={styles.statIcon} />
                    </div>
                    <div className={styles.statInfo}>
                      <h3>{totalCases}</h3>
                      <p>Total Cases</p>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <Clock className={styles.statIcon} />
                    </div>
                    <div titres={styles.statInfo}>
                      <h3>{pendingCases}</h3>
                      <p>Pending Cases</p>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <AlertCircle className={styles.statIcon} />
                    </div>
                    <div className={styles.statInfo}>
                      <h3>{highPriorityCases}</h3>
                      <p>High-Priority</p>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <CheckCircle className={styles.statIcon} />
                    </div>
                    <div className={styles.statInfo}>
                      <h3>{completedCases}</h3>
                      <p>Completed</p>
                    </div>
                  </div>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Recent Cases</h2>
                    <button onClick={() => setActiveTab("cases")} className={styles.viewAllButton}>
                      View All
                    </button>
                  </div>
                  {recentCases.length > 0 ? (
                    <div className={styles.tableWrapper}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Case Info</th>
                            <th>Case No</th>
                            <th>Priority</th>
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
                                <span className={`${styles.priorityBadge} ${styles[`priority${caseItem.priority}`]}`}>
                                  {caseItem.priority}
                                </span>
                              </td>
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
                                  onClick={() => setSelectedCase(caseItem)}
                                  className={styles.iconButton}
                                  data-tooltip-id="details-tooltip"
                                  data-tooltip-content="View case summary"
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
                      <FileText className={styles.emptyStateIcon} />
                      <p>No cases assigned yet.</p>
                      <button
                        onClick={() => {
                          setActiveTab("cases");
                          setIsCreatingCase(true);
                        }}
                        className={styles.secondaryButton}
                      >
                        Create Your First Case
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Upcoming Appointments</h2>
                    <button onClick={() => setActiveTab("appointments")} className={styles.viewAllButton}>
                      View All
                    </button>
                  </div>
                  {upcomingAppointments.length > 0 ? (
                    <div className={styles.tableWrapper}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Client Name</th>
                            <th>Date & Time</th>
                            <th>Status</th>
                            <th>Booked On</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingAppointments.map((appt) => (
                            <tr key={appt.id}>
                              <td className={styles.primaryCell}>{appt.client_name}</td>
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
                  ) : (
                    <div className={styles.emptyState}>
                      <Clock className={styles.emptyStateIcon} />
                      <p>No upcoming appointments.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "cases" && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Case Management</h2>
                  <button
                    onClick={() => setIsCreatingCase(true)}
                    className={styles.primaryButton}
                    data-tooltip-id="create-case-tooltip"
                    data-tooltip-content="Create a new case"
                  >
                    Create Case
                  </button>
                </div>
                {isCreatingCase ? (
                  <form onSubmit={handleCreateCase} className={styles.createCaseForm}>
                    <div className={styles.formSection}>
                      <h3 className={styles.formSectionTitle}>Case Basic Details</h3>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label>Case Title</label>
                          <input
                            type="text"
                            name="title"
                            value={newCaseData.title}
                            onChange={handleNewCaseChange}
                            className={styles.formInput}
                            required
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Case Type</label>
                          <select
                            name="case_type"
                            value={newCaseData.case_type}
                            onChange={handleNewCaseChange}
                            className={styles.formSelect}
                            required
                          >
                            <option value="Civil">Civil</option>
                            <option value="Criminal">Criminal</option>
                            <option value="Family">Family</option>
                            <option value="Property">Property</option>
                            <option value="Labor">Labor</option>
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label>Case Status</label>
                          <input
                            type="text"
                            name="status"
                            value={newCaseData.status}
                            className={styles.formInput}
                            disabled
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Filing Date</label>
                          <input
                            type="date"
                            name="filing_date"
                            value={newCaseData.filing_date}
                            className={styles.formInput}
                            disabled
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Jurisdiction</label>
                          <select
                            name="jurisdiction"
                            value={newCaseData.jurisdiction}
                            onChange={handleNewCaseChange}
                            className={styles.formSelect}
                            required
                          >
                            <option value="District Court">District Court</option>
                            <option value="High Court">High Court</option>
                            <option value="Supreme Court">Supreme Court</option>
                          </select>
                        </div>
                        <div className={styles.formGroup + " " + styles.fullWidth}>
                          <label>Case Description</label>
                          <textarea
                            name="description"
                            value={newCaseData.description}
                            onChange={handleNewCaseChange}
                            className={styles.formTextarea}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.formSection}>
                      <h3 className={styles.formSectionTitle}>Parties Involved</h3>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label>Client (Plaintiff)</label>
                          <select
                            name="client_id"
                            value={newCaseData.client_id}
                            onChange={handleNewCaseChange}
                            className={styles.formSelect}
                            required
                          >
                            <option value="">Select a client</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label>Plaintiff Name(s)</label>
                          <input
                            type="text"
                            name="plaintiff_name"
                            value={newCaseData.plaintiff_name}
                            onChange={handleNewCaseChange}
                            className={styles.formInput}
                            required
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Defendant Name(s)</label>
                          <input
                            type="text"
                            name="defendant_name"
                            value={newCaseData.defendant_name}
                            onChange={handleNewCaseChange}
                            className={styles.formInput}
                            required
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Assigned Lawyer</label>
                          <input
                            type="text"
                            value={lawyer?.name || "Loading..."}
                            className={styles.formInput}
                            disabled
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Priority</label>
                          <select
                            name="priority"
                            value={newCaseData.priority}
                            onChange={handleNewCaseChange}
                            className={styles.formSelect}
                            required
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className={styles.formActions}>
                      <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                        Create Case
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingCase(false)}
                        className={styles.secondaryButton}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : cases.length > 0 ? (
                  <div className={styles.tableWrapper}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Case Info</th>
                          <th>Case No</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Created At</th>
                          <th>Actions</th>
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
                              <span className={`${styles.priorityBadge} ${styles[`priority${caseItem.priority}`]}`}>
                                {caseItem.priority}
                              </span>
                            </td>
                            <td>
                              <select
                                value={caseItem.status}
                                onChange={(e) => handleStatusChange(caseItem.id, e.target.value)}
                                className={styles.statusSelect}
                                disabled={isLoading}
                              >
                                <option value="pending">Pending</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                                <option value="completed">Completed</option>
                              </select>
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
                                onClick={() => handleCaseDetails(caseItem)}
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
                    <FileText className={styles.emptyStateIcon} />
                    <p>No cases assigned yet.</p>
                    <button onClick={() => setIsCreatingCase(true)} className={styles.secondaryButton}>
                      Create Your First Case
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "appointments" && (
              <div className={styles.appointmentsContainer}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Appointments</h2>
                  </div>
                  {appointments.length > 0 ? (
                    <div className={styles.tableWrapper}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Client Name</th>
                            <th>Date & Time</th>
                            <th>Status</th>
                            <th>Booked On</th>
                            <th>Actions</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointments.map((appt) => (
                            <tr key={appt.id}>
                              <td className={styles.primaryCell}>{appt.client_name}</td>
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
                                {appt.status === "pending" && (
                                  <div className={styles.appointmentActions}>
                                    <button
                                      onClick={() => handleUpdateAppointmentStatus(appt.id, "confirmed")}
                                      className={styles.confirmButton}
                                      disabled={isLoading}
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => handleUpdateAppointmentStatus(appt.id, "cancelled")}
                                      className={styles.cancelButton}
                                      disabled={isLoading}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
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
                  ) : (
                    <div className={styles.emptyState}>
                      <Clock className={styles.emptyStateIcon} />
                      <p>No appointments scheduled.</p>
                    </div>
                  )}
                </div>
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
                        <label>Email</label>
                        <input type="email" name="email" value={formData.email} className={styles.formInput} disabled />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Specialization</label>
                        <input
                          type="text"
                          name="specialization"
                          value={formData.specialization || ""}
                          onChange={handleProfileChange}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Location</label>
                        <input
                          type="text"
                          name="location"
                          value={formData.location || ""}
                          onChange={handleProfileChange}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Availability Description</label>
                        <input
                          type="text"
                          name="availability"
                          value={formData.availability || ""}
                          onChange={handleProfileChange}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup + " " + styles.fullWidth}>
                        <label>Bio</label>
                        <textarea
                          name="bio"
                          value={formData.bio || ""}
                          onChange={handleProfileChange}
                          className={styles.formTextarea}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Availability Status</label>
                        <select
                          name="availability_status"
                          value={formData.availability_status}
                          onChange={handleProfileChange}
                          className={styles.formSelect}
                        >
                          <option value="Available">Available</option>
                          <option value="Busy">Busy</option>
                        </select>
                      </div>
                      <div className={styles.formGroup}>
                        <label>Working Hours Start</label>
                        <input
                          type="time"
                          name="working_hours_start"
                          value={formData.working_hours_start || "09:00"}
                          onChange={handleProfileChange}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Working Hours End</label>
                        <input
                          type="time"
                          name="working_hours_end"
                          value={formData.working_hours_end || "17:00"}
                          onChange={handleProfileChange}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>
                          <input
                            type="checkbox"
                            name="pro_bono_availability"
                            checked={formData.pro_bono_availability}
                            onChange={handleProfileChange}
                            className={styles.checkbox}
                          />
                          Available for Pro Bono Work
                        </label>
                      </div>
                    </div>

                    <div className={styles.formActions}>
                      <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(false)}
                        className={styles.secondaryButton}
                        disabled={isLoading}
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
                            lawyer.profile_picture
                              ? `http://127.0.0.1:5000${lawyer.profile_picture}`
                              : "https://via.placeholder.com/100"
                          }
                          alt="Profile"
                          className={styles.profileImage}
                        />
                      </div>
                      <div className={styles.profileInfo}>
                        <h2 className={styles.profileName}>
                          {lawyer.name || "Lawyer Name"}
                          <span
                            className={`${styles.kycBadge} ${lawyer.kyc_verified ? styles.kycVerified : styles.kycUnverified}`}
                          >
                            {lawyer.kyc_verified ? "Verified" : "Unverified"}
                          </span>
                        </h2>
                        <p className={styles.profileRole}>{lawyer.specialization || "Specialization N/A"}</p>
                        <div className={styles.profileStatus}>
                          <span
                            className={`${styles.statusIndicator} ${lawyer.availability_status === "Available" ? styles.statusAvailable : styles.statusBusy}`}
                          ></span>
                          {lawyer.availability_status || "Available"}
                        </div>
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className={styles.editProfileButton}
                          data-tooltip-id="edit-tooltip"
                          data-tooltip-content="Edit your profile details"
                        >
                          Edit Profile
                        </button>
                        {!lawyer.kyc_verified && (
                          <button
                            onClick={() => setIsKycFormOpen(true)}
                            className={styles.secondaryButton}
                            data-tooltip-id="kyc-tooltip"
                            data-tooltip-content="Submit KYC for verification"
                          >
                            Submit KYC Verification
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={styles.profileDetailsCard}>
                      <h3 className={styles.detailsTitle}>KYC Status</h3>
                      <p className={styles.bioText}>
                        {lawyer.kyc_status
                          ? `KYC Status: ${lawyer.kyc_status.charAt(0).toUpperCase() + lawyer.kyc_status.slice(1)}`
                          : "KYC not submitted"}
                      </p>
                    </div>


                    <div className={styles.profileDetailsCard}>
                      <h3 className={styles.detailsTitle}>Contact Information</h3>
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Email</div>
                          <div className={styles.detailValue}>{lawyer.email}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Location</div>
                          <div className={styles.detailValue}>{lawyer.location || "Not provided"}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Working Hours</div>
                          <div className={styles.detailValue}>
                            {lawyer.working_hours_start || "09:00"} - {lawyer.working_hours_end || "17:00"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.profileDetailsCard}>
                      <h3 className={styles.detailsTitle}>About</h3>
                      <p className={styles.bioText}>{lawyer.bio || "No bio information provided."}</p>
                    </div>

                    <div className={styles.profileDetailsCard}>
                      <h3 className={styles.detailsTitle}>Pro Bono Availability</h3>
                      <p className={styles.bioText}>
                        {lawyer.pro_bono_availability ? "Available for pro bono work" : "Not available for pro bono work"}
                      </p>
                    </div>

                    <div className={styles.profileDetailsCard}>
                      <h3 className={styles.detailsTitle}>Availability</h3>
                      <p className={styles.bioText}>{lawyer.availability || "No availability information provided."}</p>
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
                      <label>Preferred Contact Method</label>
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
                      <button type="submit" className={styles.primaryButton} disabled={isLoading}>
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading}
                      />
                    </div>
                    {passwordError && (
                      <div className={styles.errorMessage}>
                        <AlertCircle className={styles.errorIcon} />
                        {passwordError}
                      </div>
                    )}
                    <div className={styles.formActions}>
                      <button type="submit" className={styles.primaryButton} disabled={isLoading}>
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
                        disabled={isLoading}
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
        {dialog.isOpen && (
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
                <h3>Confirmation</h3>
              </div>
              <div className={styles.modalBody}>
                <p>{dialog.message}</p>
              </div>
              <div className={styles.modalFooter}>
                <button onClick={dialog.onConfirm} className={styles.primaryButton}>
                  Yes
                </button>
                <button
                  onClick={() => setDialog({ isOpen: false, message: "", onConfirm: null })}
                  className={styles.secondaryButton}
                >
                  No
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedCase && (
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
                <h3>Case Details: {selectedCase.title}</h3>
                <button onClick={() => setSelectedCase(null)} className={styles.closeButton}>
                  <X className={styles.closeIcon} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.caseDetail}>
                  <div className={styles.detailLabel}>Case Number</div>
                  <div className={styles.detailValue}>#{selectedCase.id}</div>
                </div>
                <div className={styles.caseDetail}>
                  <div className={styles.detailLabel}>Description</div>
                  <div className={styles.detailValue}>{selectedCase.description || "No description"}</div>
                </div>
                <div className={styles.caseDetail}>
                  <div className={styles.detailLabel}>Status</div>
                  <div className={styles.detailValue}>
                    <span
                      className={`${styles.statusBadge} ${styles[`status${selectedCase.status.charAt(0).toUpperCase() + selectedCase.status.slice(1)}`]}`}
                    >
                      {selectedCase.status}
                    </span>
                  </div>
                </div>
                <div className={styles.caseDetail}>
                  <div className={styles.detailLabel}>Priority</div>
                  <div className={styles.detailValue}>
                    <span className={`${styles.priorityBadge} ${styles[`priority${selectedCase.priority}`]}`}>
                      {selectedCase.priority}
                    </span>
                  </div>
                </div>
                <div className={styles.caseDetail}>
                  <div className={styles.detailLabel}>Created At</div>
                  <div className={styles.detailValue}>
                    {new Date(selectedCase.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button onClick={() => handleCaseDetails(selectedCase)} className={styles.primaryButton}>
                  View Full Details
                </button>
                <button onClick={() => setSelectedCase(null)} className={styles.secondaryButton}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <div className={styles.detailLabel}>Client Name</div>
                  <div className={styles.detailValue}>{selectedAppointment.client_name}</div>
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
                {selectedAppointment.status === "pending" && (
                  <div className={styles.modalActions}>
                    <button
                      onClick={() => {
                        handleUpdateAppointmentStatus(selectedAppointment.id, "confirmed");
                        setSelectedAppointment(null);
                      }}
                      className={styles.primaryButton}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => {
                        handleUpdateAppointmentStatus(selectedAppointment.id, "cancelled");
                        setSelectedAppointment(null);
                      }}
                      className={styles.dangerButton}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {selectedAppointment.status === "confirmed" && (
                  <button
                    onClick={() => handleStartCall(selectedAppointment)}
                    className={styles.primaryButton}
                    disabled={isCalling}
                  >
                    {isCalling ? 'Calling...' : 'Start Video Call'}
                  </button>
                )}

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
        {isKycFormOpen && (
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
                <h3>KYC Verification</h3>
                <button onClick={() => setIsKycFormOpen(false)} className={styles.closeButton}>
                  <X className={styles.closeIcon} />
                </button>
              </div>
              <form onSubmit={handleKycSubmit} className={styles.kycForm}>
                <div className={styles.formGroup}>
                  <label htmlFor="license_number">Lawyer License Number</label>
                  <input
                    type="text"
                    id="license_number"
                    name="license_number"
                    value={kycFormData.license_number}
                    onChange={handleKycFormChange}
                    className={styles.formInput}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="contact_number">Contact Number</label>
                  <input
                    type="tel"
                    id="contact_number"
                    name="contact_number"
                    value={kycFormData.contact_number}
                    onChange={handleKycFormChange}
                    className={styles.formInput}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="identification_document">Identification Document</label>
                  <input
                    type="file"
                    id="identification_document"
                    name="identification_document"
                    accept="image/*,application/pdf"
                    onChange={handleKycDocumentChange}
                    className={styles.formInput}
                    required
                  />
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                    Submit KYC
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsKycFormOpen(false)}
                    className={styles.secondaryButton}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
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
              {!selectedClient ? (
                <div className={styles.clientSelection}>
                  <h4>Select a Client to Chat With</h4>
                  {clients.length > 0 ? (
                    <ul className={styles.clientList}>
                      {clients.map((client) => (
                        <li
                          key={client.id}
                          onClick={() => handleClientSelect(client)}
                          className={styles.clientItem}
                        >
                          {client.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No clients available.</p>
                  )}
                </div>
              ) : !selectedCaseForChat ? (
                <div className={styles.caseSelection}>
                  <h4>Select a Case for {selectedClient.name}</h4>
                  {clientCases.length > 0 ? (
                    <ul className={styles.caseList}>
                      {clientCases.map((caseItem) => (
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
                    <p>No cases found for this client.</p>
                  )}
                  <button
                    onClick={() => setSelectedClient(null)}
                    className={styles.backButton}
                  >
                    Back to Clients
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.chatConversation}>
                    <div className={styles.chatConversationHeader}>
                      <h4>Chat for Case: {selectedCaseForChat.title}</h4>
                    </div>
                    <div className={styles.messagesContainer}>
                      {chatMessages.length > 0 ? (
                        chatMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`${styles.chatMessage} ${message.sender === "lawyer" ? styles.chatMessageSent : styles.chatMessageReceived}`}
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
              className={`${styles.notification} ${notification.type === "error" ? styles.notificationError : styles.notificationSuccess}`}
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
        </AnimatePresence>
      </div>

      <div className={styles.loaderOverlay} style={{ display: isLoading ? "flex" : "none" }}>
        <div className={styles.loader}></div>
      </div>
    </div>
  );
}