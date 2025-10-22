import { Hono } from 'hono';
import { createCard, getAllCards, getCardById, getDepartmentCards } from '../controllers/cards/CardController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const cardRouter = new Hono()

cardRouter
  .post('/', authMiddleware, createCard)
  .get('/', getAllCards)
  .get('/department', authMiddleware, getDepartmentCards) // ← Move this BEFORE /:id
  .get('/:id', getCardById)

export default cardRouter;