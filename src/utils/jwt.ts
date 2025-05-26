import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'abcdefghijklmnopqrstuvwxyz1234567890';

export const generateToken = (userId: number, userType: string) => {
  return jwt.sign({ id: userId, type: userType }, JWT_SECRET, {
    expiresIn: '1d',
  });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};