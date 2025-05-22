"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Scale } from "lucide-react"
import axios from "axios"
import { useNavigate, Link } from "react-router-dom"
import styles from "./ClientLogin.module.css"

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export default function ClientLogin() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [message, setMessage] = useState("")
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")
    setIsError(false)

    try {
      const response = await axios.post('http://127.0.0.1:5000/api/login-client', formData)
      setMessage(response.data.message)
      setIsError(false)

      // Store the token in local storage
      localStorage.setItem('clientToken', response.data.token)
      localStorage.setItem('client', JSON.stringify(response.data.client))

      setTimeout(() => navigate('/client-dashboard'), 500) // Redirect to client dashboard
    } catch (error) {
      setMessage(error.response?.data?.error || "Login failed")
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
            <h1>Client Login</h1>
            <p>Access your account to find legal assistance.</p>

            <form onSubmit={handleSubmit} className={styles.loginForm}>
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
                  disabled={isLoading}
                />
              </div>
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
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
            {message && (
              <p className={`${styles.message} ${isError ? styles.error : ''}`}>
                {message}
              </p>
            )}
            <p className={styles.authLink}>
              Don’t have an account? <Link to="/client-registration">Register here</Link>
            </p>
            <p className={styles.authLink}>
              Forgot your password? <Link to="/forgot-password/client">Reset here</Link>
            </p>
          </motion.div>
        </div>
      </section>
    </motion.div>
  )
}