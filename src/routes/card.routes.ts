import { Hono } from 'hono';
import { createCard, getAllCards, getCardById, getDepartmentCards } from '../controllers/cards/CardController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const cardRouter = new Hono()

// Make sure these routes are properly defined
cardRouter
  .post('/', authMiddleware, createCard)
  .get('/', getAllCards)
  .get('/:id', getCardById)
  .get('/department', authMiddleware, getDepartmentCards) // ← Make sure this has authMiddleware

export default cardRouter;