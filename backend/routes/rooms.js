import express from 'express';
import Room from '../models/Room.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', protect, async (req, res) => {
  const { roomName } = req.body;
  try {
    let room = await Room.findOne({ roomName });
    if (room) return res.status(400).json({ message: 'Room already exists' });

    room = new Room({ roomName, createdBy: req.user.id, participants: [req.user.id] });
    await room.save();

    res.json(room);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
