import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) return navigate('/');
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRooms(res.data);
    } catch (err) {
      setError('Failed to load rooms');
    }
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/rooms`,
        { roomName },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setRoomName('');
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create room');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div>
      <h2>Dashboard</h2>
      <button onClick={logout}>Logout</button>
      <div>
        <input
          type='text'
          placeholder='New room name'
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
        <button onClick={createRoom}>Create Room</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <h3>Available Rooms</h3>
      <ul>
        {rooms.map((room) => (
          <li key={room._id}>
            <Link to={`/room/${room.roomName}`}>{room.roomName}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
