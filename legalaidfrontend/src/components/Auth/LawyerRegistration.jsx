import { useState } from "react"
import { motion } from "framer-motion"
import { Scale } from "lucide-react"
import axios from "axios"
import { useNavigate, Link } from "react-router-dom"
import styles from "./LawyerRegistration.module.css"

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export default function LawyerRegistration() {
  const [formData, setFormData] = useState({
    name: "",
    specialization: "",
    location: "",
    availability: "",
    bio: "",
    email: "",
    password: "",
    otp: "",
    pro_bono_availability: false,
  })
  const [profilePicture, setProfilePicture] = useState(null)
  const [message, setMessage] = useState("")
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [isOtpVerified, setIsOtpVerified] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    })
  }

  const handleFileChange = (e) => {
    setProfilePicture(e.target.files[0])
  }

  const handleSendOtp = async () => {
    setIsLoading(true)
    setMessage("")
    setIsError(false)

    try {
      const response = await axios.post('http://127.0.0.1:5000/api/send-otp', {
        email: formData.email,
      })
      setMessage(response.data.message)
      setIsError(false)
      setIsOtpSent(true)
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to send OTP")
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setIsLoading(true)
    setMessage("")
    setIsError(false)

    try {
      const response = await axios.post('http://127.0.0.1:5000/api/verify-otp', {
        email: formData.email,
        otp: formData.otp,
      })
      setMessage(response.data.message)
      setIsError(false)
      setIsOtpVerified(true)
    } catch (error) {
      setMessage(error.response?.data?.error || "OTP verification failed")
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")
    setIsError(false)

    if (!isOtpVerified) {
      setMessage("Please verify OTP before registering")
      setIsError(true)
      setIsLoading(false)
      return
    }

    const data = new FormData()
    for (const key in formData) {
      if (key !== 'otp') {
        data.append(key, formData[key])
      }
    }
    if (profilePicture) {
      data.append("profile_picture", profilePicture)
    }
    data.append('is_otp_verified', isOtpVerified)

    try {
      const response = await axios.post('http://127.0.0.1:5000/api/register-lawyer', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setMessage(response.data.message)
      setIsError(false)
      setFormData({ 
        name: "", 
        specialization: "", 
        location: "", 
        availability: "", 
        bio: "", 
        email: "", 
        password: "", 
        otp: "",
        pro_bono_availability: false 
      })
      setProfilePicture(null)
      setIsOtpSent(false)
      setIsOtpVerified(false)
      setTimeout(() => navigate('/lawyer-login'), 2000)
    } catch (error) {
      setMessage(error.response?.data?.error || "Registration failed")
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      className={styles.landingPage}
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      <section className={styles.hero}>
        <div className={styles.heroContainer}>
          <motion.div className={styles.heroContent}>
            <h1>Register as a Lawyer</h1>
            <p>Join our platform to offer your legal expertise.</p>

            <form onSubmit={handleSubmit} className={styles.registrationForm}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className={styles.formInput}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="specialization">Specialization</label>
                <input
                  type="text"
                  id="specialization"
                  name="specialization"
                  placeholder="Specialization (e.g., Corporate Law)"
                  value={formData.specialization}
                  onChange={handleChange}
                  className={styles.formInput}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  placeholder="Location (e.g., Kathmandu)"
                  value={formData.location}
                  onChange={handleChange}
                  className={styles.formInput}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="availability">Availability</label>
                <input
                  type="text"
                  id="availability"
                  name="availability"
                  placeholder="Availability (e.g., Mon-Fri 9:00-17:00)"
                  value={formData.availability}
                  onChange={handleChange}
                  className={styles.formInput}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  placeholder="Bio (Tell us about yourself)"
                  value={formData.bio}
                  onChange={handleChange}
                  className={styles.formTextarea}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pro_bono_availability">
                  <input
                    type="checkbox"
                    id="pro_bono_availability"
                    name="pro_bono_availability"
                    checked={formData.pro_bono_availability}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                  Available for Pro Bono Work
                </label>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={styles.formInput}
                  disabled={isLoading || isOtpVerified}
                />
                {!isOtpSent && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className={styles.submitButton}
                    disabled={isLoading || !formData.email}
                  >
                    {isLoading ? "Sending OTP..." : "Send OTP"}
                  </button>
                )}
              </div>
              {isOtpSent && !isOtpVerified && (
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
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    className={styles.submitButton}
                    disabled={isLoading || !formData.otp}
                  >
                    {isLoading ? "Verifying OTP..." : "Verify OTP"}
                  </button>
                </div>
              )}
              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className={styles.formInput}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="profilePicture">Profile Picture (optional)</label>
                <input
                  type="file"
                  id="profilePicture"
                  name="profile_picture"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={styles.formInput}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isLoading || !isOtpVerified}
              >
                {isLoading ? "Registering..." : "Register"}
              </button>
            </form>
            {message && (
              <p className={`${styles.message} ${isError ? styles.error : ''}`}>
                {message}
              </p>
            )}
            <p className={styles.authLink}>
              Already have an account? <Link to="/lawyer-login">Login here</Link>
            </p>
          </motion.div>
        </div>
      </section>
    </motion.div>
  )
}