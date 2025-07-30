import { Hono } from 'hono';
import { createCard, getAllCards, getCardById } from '../controllers/cards/CardController.js';
import { createSubmission, getSubmissionsByCard, getFilesBySubmission, getSubmissionById } from '../controllers/cards/SubmissionController.js';

const submissionRouter = new Hono()

// Corrected routes - no duplicate /cards prefix
.get('/:id', getSubmissionsByCard)
.post('/:id', createSubmission)
.get('/:submissionId/files', getFilesBySubmission)
.get('/details/:submissionId', getSubmissionById);

export default submissionRouter;