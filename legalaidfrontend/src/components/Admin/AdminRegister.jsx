import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import styles from './AdminRegister.module.css';

const AdminRegister = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear errors for the field being edited
    setErrors({ ...errors, [name]: '' });
    setApiError('');
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/admin/register', formData);
      setSuccessMessage(response.data.message);
      setApiError('');
      setFormData({ username: '', email: '', password: '' });
      setTimeout(() => navigate('/admin/login'), 2000); // Redirect after 2 seconds
    } catch (error) {
      if (error.response) {
        setApiError(error.response.data.error || 'Registration failed');
      } else {
        setApiError('Server error. Please try again later.');
      }
      setSuccessMessage('');
    }
  };

  return (
    <div className={styles.adminRegisterContainer}>
      <div className={styles.adminRegisterCard}>
        <h2>Admin Registration</h2>
        {successMessage && <p className={styles.successMessage}>{successMessage}</p>}
        {apiError && <p className={styles.errorMessage}>{apiError}</p>}
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={errors.username ? styles.inputError : ''}
            />
            {errors.username && <span className={styles.error}>{errors.username}</span>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? styles.inputError : ''}
            />
            {errors.email && <span className={styles.error}>{errors.email}</span>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? styles.inputError : ''}
            />
            {errors.password && <span className={styles.error}>{errors.password}</span>}
          </div>
          <button type="submit" className={styles.registerButton}>
            Register
          </button>
        </form>
        <p className={styles.loginLink}>
          Already have an account? <Link to="/admin/login">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default AdminRegister;