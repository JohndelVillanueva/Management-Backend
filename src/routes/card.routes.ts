import { Hono } from 'hono';
import { createCard, getAllCards, getCardById, getCardAnalytics, getDepartmentCards } from '../controllers/cards/CardController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const cardRouter = new Hono()

cardRouter
  .post('/', authMiddleware, createCard)
  .get('/', getAllCards)
  .get('/department', authMiddleware, getDepartmentCards) // ← Move this BEFORE /:id
  .get('/analytics/cards', authMiddleware, getCardAnalytics) // Add this route
  .get('/:id', getCardById)

export default cardRouter;