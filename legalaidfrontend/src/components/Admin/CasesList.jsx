import React, { useEffect, useState } from 'react';
import { getCases, deleteCase } from './api';
import styles from './CasesList.module.css';

const CasesList = () => {
  const [cases, setCases] = useState([]);
  const [error, setError] = useState('');

  const fetchCases = async () => {
    try {
      const response = await getCases();
      setCases(response.data.cases);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch cases');
    }
  };

  const handleDelete = async (caseId) => {
    if (window.confirm('Are you sure you want to delete this case?')) {
      try {
        await deleteCase(caseId);
        setCases(cases.filter((c) => c.id !== caseId));
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete case');
      }
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  return (
    <div className={styles.container}>
      <h2>Cases</h2>
      {error && <p className={styles.error}>{error}</p>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Type</th>
            <th>Status</th>
            <th>Lawyer</th>
            <th>Client</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.title}</td>
              <td>{c.case_type}</td>
              <td>{c.status}</td>
              <td>{c.lawyer_name}</td>
              <td>{c.client_name}</td>
              <td>
                <button
                  onClick={() => handleDelete(c.id)}
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

export default CasesList;