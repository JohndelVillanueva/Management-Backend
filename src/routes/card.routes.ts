import { Hono } from 'hono';
import { createCard, getAllCards, getCardById, getDepartmentCards} from '../controllers/cards/CardController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

// import { createSubmission, getSubmissionsByCard,getFilesBySubmission, } from '../controllers/cards/SubmissionController.js';

const cardRouter = new Hono()

// Corrected routes - no duplicate /cards prefix
// .get('/:id/submissions', getSubmissionsByCard)
.post('/', authMiddleware, createCard )
.get('/', getAllCards)
.get('/:id', getCardById)
.get('/department', getDepartmentCards)
// .post('/:id/submissions', createSubmission)

export default cardRouter;