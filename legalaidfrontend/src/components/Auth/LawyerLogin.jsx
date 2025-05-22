"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Scale } from "lucide-react"
import axios from "axios"
import { useNavigate, Link } from "react-router-dom"
import styles from "./LawyerLogin.module.css"

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export default function LawyerLogin() {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
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
      const response = await axios.post('http://127.0.0.1:5000/api/login-lawyer', formData)
      setMessage(response.data.message)
      setIsError(false)

      // Store JWT in localStorage
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('lawyer', JSON.stringify(response.data.lawyer))

      // Redirect to dashboard
      navigate('/lawyerdashboard')
    } catch (error) {
      setMessage(error.response?.data?.error || "Login failed")
      setIsError(true)
    } finally {
      setIsLoading(false)
      setFormData({ email: "", password: "" })
    }
  }

  return (
    <motion.div
      className={styles.loginPage}
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      <section className={styles.loginSection}>
        <div className={styles.loginContainer}>
          <motion.div className={styles.loginContent}>
            <h1>Lawyer Login</h1>
            <p>Access your account to manage your legal services.</p>

            <form onSubmit={handleSubmit} className={styles.loginForm}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                className={styles.formInput}
                disabled={isLoading}
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className={styles.formInput}
                disabled={isLoading}
              />
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
              Don't have an account yet? <Link to="/register-lawyer">Register here</Link>
            </p>
            <p className={styles.authLink}>
              Forgot your password? <Link to="/forgot-password/lawyer">Reset here</Link>
            </p>
          </motion.div>
        </div>
      </section>
    </motion.div>
  )
}