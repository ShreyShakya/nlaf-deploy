import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scale, Search, Leaf } from "lucide-react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import legalServices from "../utils/legalServices";
import styles from "./BrowseLawyers.module.css";

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const slideUp = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

export default function BrowseLawyers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedService, setSelectedService] = useState("");
  const [lawyers, setLawyers] = useState([]);
  const [filters, setFilters] = useState({
    location: "",
    minRating: "",
    availabilityStatus: "",
    proBonoAvailability: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const serviceFromUrl = searchParams.get("service");

    if (serviceFromUrl) {
      setSearchQuery(decodeURIComponent(serviceFromUrl));
      setSelectedService(decodeURIComponent(serviceFromUrl));
      fetchLawyers(decodeURIComponent(serviceFromUrl), filters);
    } else {
      fetchLawyers("", filters);
    }
  }, [searchParams, filters]);

  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim() === "") {
      setSuggestions([]);
      setSelectedService("");
      setLawyers([]);
      fetchLawyers("", filters);
      setSearchParams({});
      return;
    }

    const filteredSuggestions = legalServices.filter((service) =>
      service.toLowerCase().includes(query.toLowerCase())
    );
    setSuggestions(filteredSuggestions);
  };

  const handleSuggestionClick = (service) => {
    setSearchQuery(service);
    setSelectedService(service);
    setSuggestions([]);
    fetchLawyers(service, filters);
    setSearchParams({ service });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const newFilters = { ...prev, [name]: value };
      if (selectedService) {
        fetchLawyers(selectedService, newFilters);
      } else {
        fetchLawyers("", newFilters);
      }
      return newFilters;
    });
  };

  const fetchLawyers = async (service, filters) => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get("http://127.0.0.1:5000/api/lawyers", {
        params: {
          specialization: service || undefined,
          location: filters.location,
          min_rating: filters.minRating,
          availability_status: filters.availabilityStatus,
          pro_bono_availability: filters.proBonoAvailability,
        },
      });
      setLawyers(response.data.lawyers);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch lawyers");
      setLawyers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim() === "") return;

    const serviceToSearch = selectedService || suggestions[0] || searchQuery;
    setSearchQuery(serviceToSearch);
    setSelectedService(serviceToSearch);
    setSuggestions([]);
    fetchLawyers(serviceToSearch, filters);
    setSearchParams({ service: serviceToSearch });
  };

  const handleViewProfile = (lawyerId) => {
    navigate(`/lawyer-profile/${lawyerId}`);
  };

  const handleImageError = (e) => {
    e.target.style.display = "none";
    e.target.nextSibling.style.display = "flex";
  };

  return (
    <motion.div
      className={styles.browseLawyers}
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      <header className={styles.header}>
        <div className={styles.container}>
          <a href="/">
            <div className={styles.logo}>
              <Scale className={styles.logoIcon} />
              <span>NepaliLegalAidFinder</span>
            </div>
          </a>
        </div>
      </header>

      <section className={styles.searchSection}>
        <div className={styles.container}>
          <motion.div className={styles.searchContent} variants={slideUp}>
            <h1>Browse Lawyers</h1>
            <p>Find the right legal expert for your needs.</p>

            <motion.form
              onSubmit={handleSearch}
              className={styles.searchForm}
              variants={slideUp}
            >
              <div className={styles.searchInput}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search by legal service (e.g., Divorce)"
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
      </section>

      <motion.section
        className={styles.resultsSection}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeIn}
      >
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <motion.h2 variants={slideUp}>
              {selectedService
                ? `Lawyers Specializing in ${selectedService}`
                : "Featured Lawyers"}
            </motion.h2>
          </div>

          <form className={styles.filterForm}>
            <div className={styles.filterGroup}>
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                name="location"
                placeholder="e.g., Kathmandu"
                value={filters.location}
                onChange={handleFilterChange}
                className={styles.filterInput}
              />
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="minRating">Minimum Rating</label>
              <select
                id="minRating"
                name="minRating"
                value={filters.minRating}
                onChange={handleFilterChange}
                className={styles.filterInput}
              >
                <option value="">Any</option>
                <option value="1">1 Star & Up</option>
                <option value="2">2 Stars & Up</option>
                <option value="3">3 Stars & Up</option>
                <option value="4">4 Stars & Up</option>
                <option value="5">5 Stars</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="availabilityStatus">Availability</label>
              <select
                id="availabilityStatus"
                name="availabilityStatus"
                value={filters.availabilityStatus}
                onChange={handleFilterChange}
                className={styles.filterInput}
              >
                <option value="">Any</option>
                <option value="Available">Available</option>
                <option value="Busy">Busy</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="proBonoAvailability">Pro Bono Availability</label>
              <select
                id="proBonoAvailability"
                name="proBonoAvailability"
                value={filters.proBonoAvailability}
                onChange={handleFilterChange}
                className={styles.filterInput}
              >
                <option value="">Any</option>
                <option value="true">Available</option>
                <option value="false">Not Available</option>
              </select>
            </div>
          </form>

          {loading ? (
            <p>Loading...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : lawyers.length === 0 ? (
            <p>
              {selectedService
                ? `No lawyers found for ${selectedService}.`
                : "No lawyers available at the moment."}
            </p>
          ) : (
            <motion.div
              className={styles.lawyerGrid}
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
              {lawyers.map((lawyer) => (
                <motion.div
                  key={lawyer.id}
                  className={styles.lawyerCard}
                  variants={slideUp}
                  transition={{ duration: 0.3 }}
                >
                  <div className={styles.lawyerImage}>
                    {lawyer.profile_picture ? (
                      <>
                        <img
                          src={`http://127.0.0.1:5000${lawyer.profile_picture}`}
                          alt={lawyer.name}
                          className={styles.profilePicture}
                          onError={handleImageError}
                        />
                        <div
                          className={styles.placeholderPicture}
                          style={{ display: "none" }}
                        >
                          No Image
                        </div>
                      </>
                    ) : (
                      <div className={styles.placeholderPicture}>No Image</div>
                    )}
                    {(lawyer.pro_bono_availability === true || lawyer.pro_bono_availability === 1) && (
                      <span className={styles.proBonoTag}>
                        <Leaf className={styles.leafIcon} />
                        Pro Bono
                      </span>
                    )}
                  </div>
                  <div className={styles.lawyerInfo}>
                    <h3>{lawyer.name}</h3>
                    <p>
                      <strong>Specialization:</strong>{" "}
                      {lawyer.specialization || "Not specified"}
                    </p>
                    <p>
                      <strong>Location:</strong>{" "}
                      {lawyer.location || "Not specified"}
                    </p>
                    <p>
                      <strong>Rating:</strong>{" "}
                      {lawyer.rating ? lawyer.rating.toFixed(1) : "Not rated"}
                    </p>
                    <p>
                      <strong>Availability:</strong>{" "}
                      {lawyer.availability_status || "Not specified"}
                    </p>
                    <p>
                      <strong>Pro Bono:</strong>{" "}
                      {lawyer.pro_bono_availability ? "Available" : "Not Available"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleViewProfile(lawyer.id)}
                    className={styles.viewProfileButton}
                  >
                    View Profile
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}