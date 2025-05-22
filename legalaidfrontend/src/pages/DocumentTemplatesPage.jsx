"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FileText, Download, Scale, ChevronRight } from "lucide-react"
import axios from "axios"
import styles from "./DocumentTemplatesPage.module.css"

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const slideUp = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1 },
}

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [error, setError] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [lawyerDropdownOpen, setLawyerDropdownOpen] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await axios.get("http://127.0.0.1:5000/api/document-templates")
      setTemplates(response.data.templates)
    } catch (err) {
      setError("Failed to load document templates. Please try again later.")
      console.error("Error fetching templates:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (downloadUrl, originalFilename) => {
    try {
      const response = await axios.get(`http://127.0.0.1:5000${downloadUrl}`, {
        responseType: "blob",
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", originalFilename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(
        err.response?.status === 404
          ? "Template file not found."
          : "Failed to download the template. Please try again.",
      )
      console.error("Error downloading template:", err)
    }
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <a href="/">
            <div className={styles.logo}>
              <Scale className={styles.logoIcon} />
              <span>NepaliLegalAidFinder</span>
            </div>
          </a>
          <div
            className={`${styles.mobileMenuButton} ${mobileMenuOpen ? styles.active : ""}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </div>

          <nav className={`${styles.mainNav} ${mobileMenuOpen ? styles.open : ""}`}>
            <ul>
              <li>
                <a href="/">Features</a>
              </li>
              <li>
                <a href="/">Attorneys</a>
              </li>
              <li>
                <a href="/">Contact</a>
              </li>
              <li>
                <a href="/document-templates">Document Templates</a>
              </li>
            </ul>
          </nav>

          <div className={styles.headerButtonGroup}>
            <a href="/client-login" className={styles.ctaButton}>
              Get Started
            </a>

            <div className={styles.dropdownContainer}>
              <button
                className={styles.dropdownButton}
                onClick={() => setLawyerDropdownOpen(!lawyerDropdownOpen)}
                onBlur={() => setTimeout(() => setLawyerDropdownOpen(false), 100)}
              >
                For Lawyers
                <ChevronRight
                  className={`${styles.dropdownIcon} ${lawyerDropdownOpen ? styles.dropdownIconOpen : ""}`}
                />
              </button>
              {lawyerDropdownOpen && (
                <ul className={styles.dropdownMenu}>
                  <li>
                    <a href="/lawyer-login">Login</a>
                  </li>
                  <li>
                    <a href="/register-lawyer">Register</a>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Document Templates Section */}
      <motion.section
        className={styles.templatesSection}
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={fadeIn}
      >
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <motion.span className={styles.sectionTag} variants={slideUp}>
              Resources
            </motion.span>
            <motion.h2 variants={slideUp}>Document Templates</motion.h2>
            <motion.p variants={slideUp}>
              Access a variety of legal document templates to assist with your case preparation. Download and customize
              them as needed.
            </motion.p>
          </div>

          <div className={styles.templatesGrid}>
            {loading ? (
              <motion.div className={styles.loadingContainer} variants={slideUp}>
                <div className={styles.spinner}></div>
                <p>Loading templates...</p>
              </motion.div>
            ) : error ? (
              <motion.div
                className={styles.errorMessage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {error}
              </motion.div>
            ) : templates.length > 0 ? (
              templates.map((template, index) => (
                <motion.div
                  key={index}
                  className={styles.templateCard}
                  variants={slideUp}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className={styles.templateIconWrapper}>
                    <FileText className={styles.templateIcon} />
                  </div>
                  <h3>{template.original_filename}</h3>
                  <p>Download this template to get started with your legal documentation.</p>
                  <button
                    className={styles.downloadButton}
                    onClick={() => handleDownload(template.download_url, template.original_filename)}
                  >
                    <Download className={styles.buttonIcon} />
                    Download
                  </button>
                </motion.div>
              ))
            ) : (
              <motion.p className={styles.emptyState} variants={slideUp}>
                No templates available at the moment.
              </motion.p>
            )}
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <div className={styles.footerLogo}>
              <Scale className={styles.logoIcon} />
              <span>NepaliLegalAidFinder</span>
            </div>
            <div className={styles.footerLinks}>
              <a href="/about">About Us</a>
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>© {new Date().getFullYear()} NepaliLegalAidFinder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}