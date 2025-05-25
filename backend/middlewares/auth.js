import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export const verifyTokenSocket = (socket) => {
  const token = socket.handshake.auth.token;
  if (!token) throw new Error('No token');

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  socket.user = decoded;
};
