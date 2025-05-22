import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Scale, FileText, Users, MessageSquare, Shield, ArrowRight, Mail, Phone, MapPin, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import legalServices from "../utils/legalServices"; // Import the shared legalServices array
import styles from "./LandingPage.module.css";

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const slideUp = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lawyerDropdownOpen, setLawyerDropdownOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Handle search input and show suggestions
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim() === "") {
      setSuggestions([]);
      return;
    }

    const filteredSuggestions = legalServices.filter((service) =>
      service.toLowerCase().includes(query.toLowerCase())
    );
    setSuggestions(filteredSuggestions);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (service) => {
    setSearchQuery(service);
    setSuggestions([]);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to BrowseLawyers with the search query as a URL parameter
      navigate(`/browse-lawyers?service=${encodeURIComponent(searchQuery)}`);
    }
  };

  const features = [
    {
      icon: <FileText className={styles.featureIcon} />,
      title: "Case Tracking",
      description: "Monitor progress and deadlines for all your legal cases in one centralized dashboard.",
    },
    {
      icon: <Users className={styles.featureIcon} />,
      title: "Pro Bono Support",
      description: "Access specialized assistance for non-profits and pro bono legal representation.",
    },
    {
      icon: <MessageSquare className={styles.featureIcon} />,
      title: "Legal Consultation",
      description: "Connect with legal experts through secure voice and video calls for convenient advice.",
    },
    {
      icon: <Shield className={styles.featureIcon} />,
      title: "Document Templates",
      description: "Get access to downloadable legal document templates with ease.",
    },
  ];

  const attorneys = [
    {
      name: "Sabin Shrestha",
      specialty: "Corporate Law",
      image: "https://randomuser.me/api/portraits/men/32.jpg",
    },
    {
      name: "Sujal Prajapati",
      specialty: "Family Law",
      image: "https://randomuser.me/api/portraits/women/28.jpg",
    },
    {
      name: "Ratish Bajracharya",
      specialty: "Criminal Defense",
      image: "https://randomuser.me/api/portraits/men/64.jpg",
    },
  ];

  return (
    <div className={styles.landingPage}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.logo}>
            <Scale className={styles.logoIcon} />
            <span>NepaliLegalAidFinder</span>
          </div>

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
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#attorneys">Attorneys</a>
              </li>
              <li>
                <a href="#contact">Contact</a>
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
                  <li><a href="/lawyer-login">Login</a></li>
                  <li><a href="/register-lawyer">Register</a></li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section
        className={styles.hero}
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={fadeIn}
      >
        <div className={styles.container}>
          <motion.div className={styles.heroContent} variants={slideUp} transition={{ duration: 0.5 }}>
            <h1>Legal Solutions Made Simple</h1>
            <p>
              Navigate complex legal matters with confidence using our intuitive platform designed for individuals and
              businesses in Nepal.
            </p>

            <motion.form
              onSubmit={handleSearch}
              className={styles.searchForm}
              variants={slideUp}
              transition={{ delay: 0.2 }}
            >
              <div className={styles.searchInput}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="What legal assistance do you need?"
                  value={searchQuery}
                  onChange={handleSearchInput}
                  autoComplete="off"
                />
                {suggestions.length > 0 && (
                  <ul className={styles.suggestions}>
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={styles.suggestionItem}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="submit" className={styles.searchButton}>
                Search
              </button>
            </motion.form>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        id="features"
        className={styles.features}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeIn}
      >
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <motion.span className={styles.sectionTag} variants={slideUp}>
              Features
            </motion.span>
            <motion.h2 variants={slideUp}>Streamlined Legal Support</motion.h2>
            <motion.p variants={slideUp}>Our platform offers essential tools to simplify your legal journey.</motion.p>
          </div>

          <motion.div
            className={styles.featuresGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
          >
            {features.map((feature, index) => (
              <motion.div key={index} className={styles.featureCard} variants={slideUp} transition={{ duration: 0.3 }}>
                <div className={styles.featureIconWrapper}>{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Attorneys Section */}
      <motion.section
        id="attorneys"
        className={styles.attorneys}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeIn}
      >
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <motion.span className={styles.sectionTag} variants={slideUp}>
              Our Team
            </motion.span>
            <motion.h2 variants={slideUp}>Expert Attorneys</motion.h2>
            <motion.p variants={slideUp}>Meet our experienced legal professionals dedicated to your success.</motion.p>
          </div>

          <motion.div
            className={styles.attorneysGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
          >
            {attorneys.map((attorney, index) => (
              <motion.div key={index} className={styles.attorneyCard} variants={slideUp} transition={{ duration: 0.3 }}>
                <div className={styles.attorneyImage}>
                  <img src={attorney.image || "/placeholder.svg"} alt={attorney.name} />
                </div>
                <div className={styles.attorneyInfo}>
                  <h3>{attorney.name}</h3>
                  <p>{attorney.specialty}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        className={styles.cta}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeIn}
      >
        <div className={styles.container}>
          <motion.div className={styles.ctaContent} variants={slideUp}>
            <h2>Ready to Get Started?</h2>
            <p>Take the first step toward expert legal representation today.</p>
            <motion.a
              href="/browse-lawyers"
              className={styles.primaryButton}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Schedule a Consultation <ArrowRight size={16} />
            </motion.a>
          </motion.div>
        </div>
      </motion.section>

      {/* Contact Section */}
      <motion.section
        id="contact"
        className={styles.contact}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeIn}
      >
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <motion.span className={styles.sectionTag} variants={slideUp}>
              Contact
            </motion.span>
            <motion.h2 variants={slideUp}>Get In Touch</motion.h2>
            <motion.p variants={slideUp}>Our team is here to help with any questions you may have.</motion.p>
          </div>

          <motion.div className={styles.contactMethods} variants={slideUp}>
            <div className={styles.contactMethod}>
              <Phone className={styles.contactIcon} />
              <div>
                <h4>Call Us</h4>
                <p>(555) 123-4567</p>
              </div>
            </div>

            <div className={styles.contactMethod}>
              <Mail className={styles.contactIcon} />
              <div>
                <h4>Email Us</h4>
                <p>info@nlaf.com</p>
              </div>
            </div>

            <div className={styles.contactMethod}>
              <MapPin className={styles.contactIcon} />
              <div>
                <h4>Visit Us</h4>
                <p>123 Street, Kathmandu, Nepal</p>
              </div>
            </div>
          </motion.div>
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
            <p>Your trusted partner for all legal matters.</p>
          </div>

          <div className={styles.footerLinks}>
            <div className={styles.footerLinksColumn}>
              <h4>Navigation</h4>
              <ul>
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#attorneys">Attorneys</a>
                </li>
                <li>
                  <a href="#contact">Contact</a>
                </li>
              </ul>
            </div>

            <div className={styles.footerLinksColumn}>
              <h4>Legal</h4>
              <ul>
                <li>
                  <a href="#">Privacy Policy</a>
                </li>
                <li>
                  <a href="#">Terms of Service</a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>© {new Date().getFullYear()} NepaliLegalAidFinder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}