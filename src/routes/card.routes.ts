// src/routes/card.routes.ts
import { Hono } from 'hono';
import { 
  createCard, 
  getAllCards, 
  getCardById, 
  getDepartmentCards 
} from '../controllers/cards/CardController.js';
import { getCardAnalytics } from '../controllers/cards/CardAnalyticsController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const cardRouter = new Hono()

cardRouter
  .post('/', authMiddleware, createCard)
  .get('/', getAllCards)
  .get('/department', authMiddleware, getDepartmentCards)
  .get('/analytics/cards', authMiddleware, getCardAnalytics) // Fixed this route
  .get('/:id', getCardById)

export default cardRouter;