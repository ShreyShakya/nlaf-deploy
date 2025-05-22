import React, { useEffect, useState } from 'react';
import { getAppointments, deleteAppointment } from './api';
import styles from './AppointmentsList.module.css';

const AppointmentsList = () => {
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState('');

  const fetchAppointments = async () => {
    try {
      const response = await getAppointments();
      setAppointments(response.data.appointments);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch appointments');
    }
  };

  const handleDelete = async (appointmentId) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      try {
        await deleteAppointment(appointmentId);
        setAppointments(appointments.filter((a) => a.id !== appointmentId));
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete appointment');
      }
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  return (
    <div className={styles.container}>
      <h2>Appointments</h2>
      {error && <p className={styles.error}>{error}</p>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Date</th>
            <th>Status</th>
            <th>Lawyer</th>
            <th>Client</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{new Date(a.appointment_date).toLocaleString()}</td>
              <td>{a.status}</td>
              <td>{a.lawyer_name}</td>
              <td>{a.client_name}</td>
              <td>
                <button
                  onClick={() => handleDelete(a.id)}
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

export default AppointmentsList;