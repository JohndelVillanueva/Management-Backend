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

// Fix the route order and remove duplicates
cardRouter
  .post('/', authMiddleware, createCard)
  .get('/', getAllCards)
  .get('/department', authMiddleware, getDepartmentCards)
  .get('/analytics', getCardAnalytics) // ✅ CORRECT ROUTE - /cards/analytics
  .get('/:id', getCardById);

export default cardRouter;