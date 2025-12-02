import { Hono } from 'hono';
import { 
  createSubmission, 
  getSubmissionsByCard, 
  getFilesBySubmission, 
  getSubmissionById, 
  getAllSubmissions,
} from '../controllers/cards/SubmissionController.js';
import { getMySubmissions } from '../controllers/cards/SubmissionController.js'; // Import the function

const submissionRouter = new Hono();

submissionRouter
  .get('/', getAllSubmissions)
  .get('/my-submissions', getMySubmissions) // ✅ Add this line
  .get('/:id', getSubmissionsByCard)
  .post('/:id', createSubmission)
  .get('/:submissionId/files', getFilesBySubmission)
  .get('/details/:submissionId', getSubmissionById)

export default submissionRouter;