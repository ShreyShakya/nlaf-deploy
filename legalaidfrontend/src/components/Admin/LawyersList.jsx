import React, { useEffect, useState } from 'react';
import { getLawyers, deleteLawyer } from './api';
import styles from './LawyersList.module.css';

const LawyersList = () => {
  const [lawyers, setLawyers] = useState([]);
  const [error, setError] = useState('');

  const fetchLawyers = async () => {
    try {
      const response = await getLawyers();
      setLawyers(response.data.lawyers);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch lawyers');
    }
  };

  const handleDelete = async (lawyerId) => {
    if (window.confirm('Are you sure you want to delete this lawyer?')) {
      try {
        await deleteLawyer(lawyerId);
        setLawyers(lawyers.filter((lawyer) => lawyer.id !== lawyerId));
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete lawyer');
      }
    }
  };

  useEffect(() => {
    fetchLawyers();
  }, []);

  return (
    <div className={styles.container}>
      <h2>Lawyers</h2>
      {error && <p className={styles.error}>{error}</p>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Specialization</th>
            <th>Location</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lawyers.map((lawyer) => (
            <tr key={lawyer.id}>
              <td>{lawyer.id}</td>
              <td>{lawyer.name}</td>
              <td>{lawyer.email}</td>
              <td>{lawyer.specialization}</td>
              <td>{lawyer.location}</td>
              <td>{lawyer.availability_status}</td>
              <td>
                <button
                  onClick={() => handleDelete(lawyer.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LawyersList;