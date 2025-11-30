import { Hono } from 'hono';
import { createCard, getAllCards, getCardById } from '../controllers/cards/CardController.js';
import { createSubmission, getSubmissionsByCard, getFilesBySubmission, getSubmissionById, getAllSubmissions } from '../controllers/cards/SubmissionController.js';

const submissionRouter = new Hono()

// Add this route to get all submissions
.get('/', getAllSubmissions) // 👈 ADD THIS LINE
.get('/:id', getSubmissionsByCard)
.post('/:id', createSubmission)
.get('/:submissionId/files', getFilesBySubmission)
.get('/details/:submissionId', getSubmissionById);

export default submissionRouter;