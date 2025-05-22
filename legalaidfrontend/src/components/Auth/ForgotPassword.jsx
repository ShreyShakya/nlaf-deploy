"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Scale } from "lucide-react"
import axios from "axios"
import { useNavigate, useParams } from "react-router-dom"
import styles from "./ForgotPassword.module.css" // Assume a CSS module for styling

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export default function ForgotPassword() {
  const { role } = useParams() // Get role from URL (client or lawyer)
  const [step, setStep] = useState(1) // 1: Request OTP, 2: Verify OTP and reset password
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [message, setMessage] = useState("")
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")
    setIsError(false)

    try {
      const response = await axios.post(`http://127.0.0.1:5000/api/send-password-reset-otp`, {
        email: formData.email,
        role,
      })
      setMessage(response.data.message)
      setIsError(false)
      setStep(2) // Move to OTP verification step
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to send OTP")
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")
    setIsError(false)

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage("Passwords do not match")
      setIsError(true)
      setIsLoading(false)
      return
    }

    if (formData.newPassword.length < 8) {
      setMessage("New password must be at least 8 characters long")
      setIsError(true)
      setIsLoading(false)
      return
    }

    try {
      const response = await axios.post(`http://127.0.0.1:5000/api/reset-password`, {
        email: formData.email,
        otp: formData.otp,
        new_password: formData.newPassword,
        role,
      })
      setMessage(response.data.message)
      setIsError(false)
      setTimeout(() => navigate(`/${role}-login`), 1000) // Redirect to login page
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to reset password")
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      className={styles.forgotPasswordPage}
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      <section className={styles.hero}>
        <div className={styles.heroContainer}>
          <motion.div className={styles.heroContent}>
            <h1>{role.charAt(0).toUpperCase() + role.slice(1)} Password Reset</h1>
            <p>Reset your password to regain access to your account.</p>

            {step === 1 ? (
              <form onSubmit={handleRequestOtp} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={styles.formInput}
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isLoading}
                >
                  {isLoading ? "Sending OTP..." : "Send OTP"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="otp">OTP</label>
                  <input
                    type="text"
                    id="otp"
                    name="otp"
                    placeholder="Enter OTP"
                    value={formData.otp}
                    onChange={handleChange}
                    required
                    className={styles.formInput}
                    disabled={isLoading}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    placeholder="Enter new password"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                    className={styles.formInput}
                    disabled={isLoading}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="Confirm new password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className={styles.formInput}
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isLoading}
                >
                  {isLoading ? "Resetting Password..." : "Reset Password"}
                </button>
              </form>
            )}
            {message && (
              <p className={`${styles.message} ${isError ? styles.error : ''}`}>
                {message}
              </p>
            )}
          </motion.div>
        </div>
      </section>
    </motion.div>
  )
}