import { Hono } from 'hono';
import { 
  createCard, 
  getAllCards, 
  getCardById, 
  getDepartmentCards,
  getCardUsers  // Add this import
} from '../controllers/cards/CardController.js';
import { getCardAnalytics } from '../controllers/cards/CardAnalyticsController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const cardRouter = new Hono()

// Fix the route order and remove duplicates
cardRouter
  .post('/', authMiddleware, createCard)
  .get('/', getAllCards)
  .get('/department', authMiddleware, getDepartmentCards)
  .get('/analytics', getCardAnalytics)
  .get('/:id', getCardById)
  .get('/:id/users', getCardUsers);  // Add this route

export default cardRouter;