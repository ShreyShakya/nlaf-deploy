import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle } from "lucide-react";
import styles from "./VerifyKyc.module.css"; // Create this CSS module

export default function VerifyKyc() {
  const [formData, setFormData] = useState({
    id_number: "",
    document_type: "National ID",
    full_name: "",
    address: "",
    phone_number: "",
  });
  const [documentFile, setDocumentFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/lawyer-login");
        return;
      }
      try {
        const response = await axios.get("http://127.0.0.1:5000/api/lawyer-profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setVerificationStatus(response.data.lawyer.verification_status || "Unverified");
        setFormData({
          id_number: response.data.lawyer.id_number || "",
          document_type: response.data.lawyer.document_type || "National ID",
          full_name: response.data.lawyer.full_name || response.data.lawyer.name || "",
          address: response.data.lawyer.address || "",
          phone_number: response.data.lawyer.phone_number || "",
        });
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load profile");
      }
    };
    fetchProfile();
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }
    setDocumentFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const token = localStorage.getItem("token");

    if (!formData.id_number || !formData.full_name || !formData.address || !formData.phone_number || !documentFile) {
      setError("All fields and document upload are required");
      return;
    }

    const submitData = new FormData();
    submitData.append("id_number", formData.id_number);
    submitData.append("document_type", formData.document_type);
    submitData.append("full_name", formData.full_name);
    submitData.append("address", formData.address);
    submitData.append("phone_number", formData.phone_number);
    submitData.append("document", documentFile);

    setIsLoading(true);
    try {
      const response = await axios.post("http://127.0.0.1:5000/api/submit-kyc", submitData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setSuccess(response.data.message || "KYC submitted successfully. Awaiting admin verification.");
      setVerificationStatus("Pending");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit KYC");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.kycPage}>
      <motion.div
        className={styles.kycContainer}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className={styles.kycTitle}>KYC Verification</h2>
        <p className={styles.kycDescription}>
          {verificationStatus === "Verified"
            ? "Your account is verified."
            : verificationStatus === "Pending"
            ? "Your KYC is pending admin approval."
            : "Please complete the KYC verification to verify your account."}
        </p>

        <form onSubmit={handleSubmit} className={styles.kycForm}>
          <div className={styles.formGroup}>
            <label htmlFor="full_name">Full Name</label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              className={styles.formInput}
              disabled={verificationStatus === "Verified" || isLoading}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="document_type">Document Type</label>
            <select
              id="document_type"
              name="document_type"
              value={formData.document_type}
              onChange={handleInputChange}
              className={styles.formSelect}
              disabled={verificationStatus === "Verified" || isLoading}
              required
            >
              <option value="National ID">National ID</option>
              <option value="Passport">Passport</option>
              <option value="License">License</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="id_number">ID Number</label>
            <input
              type="text"
              id="id_number"
              name="id_number"
              value={formData.id_number}
              onChange={handleInputChange}
              className={styles.formInput}
              disabled={verificationStatus === "Verified" || isLoading}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className={styles.formInput}
              disabled={verificationStatus === "Verified" || isLoading}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="phone_number">Phone Number</label>
            <input
              type="tel"
              id="phone_number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleInputChange}
              className={styles.formInput}
              disabled={verificationStatus === "Verified" || isLoading}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="document">Upload Document</label>
            <input
              type="file"
              id="document"
              name="document"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className={styles.formInput}
              disabled={verificationStatus === "Verified" || isLoading}
              required={verificationStatus !== "Pending"}
            />
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <AlertCircle className={styles.errorIcon} />
              {error}
            </div>
          )}
          {success && (
            <div className={styles.successMessage}>
              <CheckCircle className={styles.successIcon} />
              {success}
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading || verificationStatus === "Verified"}
            >
              {isLoading ? "Submitting..." : "Submit KYC"}
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => navigate("/lawyer-dashboard")}
              disabled={isLoading}
            >
              Back to Dashboard
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}