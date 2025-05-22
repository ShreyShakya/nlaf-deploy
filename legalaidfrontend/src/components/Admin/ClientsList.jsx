import React, { useEffect, useState } from 'react';
import { getClients, deleteClient } from './api';
import styles from './ClientsList.module.css';

const ClientsList = () => {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');

  const fetchClients = async () => {
    try {
      const response = await getClients();
      setClients(response.data.clients);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch clients');
    }
  };

  const handleDelete = async (clientId) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await deleteClient(clientId);
        setClients(clients.filter((client) => client.id !== clientId));
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete client');
      }
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  return (
    <div className={styles.container}>
      <h2>Clients</h2>
      {error && <p className={styles.error}>{error}</p>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>{client.id}</td>
              <td>{client.name}</td>
              <td>{client.email}</td>
              <td>{client.phone}</td>
              <td>{client.address}</td>
              <td>
                <button
                  onClick={() => handleDelete(client.id)}
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

export default ClientsList;