import { Hono } from 'hono';
import { createCard, getAllCards, getCardById } from '../controllers/cards/CardController.js';
import { createSubmission, getSubmissionsByCard,getFilesBySubmission } from '../controllers/cards/SubmissionController.js';
import { getFileById } from '../controllers/cards/FileController.js';

const fileRouter = new Hono()
  .get('/:fileId', getFileById);


export default fileRouter;