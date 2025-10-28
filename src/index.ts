import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import authRouter from './routes/auth.route.js';
import prisma from './utils/db.js';
import departmentRouter from './routes/department.routes.js';
import cardRouter from './routes/card.routes.js';
import 'dotenv/config'; 
import submissionRouter from './routes/submission.route.js';
import fileRouter from './routes/file.route.js';
import usersRoute from './routes/user.route.js';
import headRoute  from './routes/head.routes.js'; 
import { activitiesRoute } from './routes/acitivities.route.js';

  
const app = new Hono();

// Middleware
app.use('*',   cors({
    origin: 'http://localhost:5173', // Specific origin, not '*'
    credentials: true,               // Important: allow credentials (cookies)
  }));

// Serve uploaded files
app.use('/uploads/*', serveStatic({ root: './' }));

  app.use('*', async (c, next) => {
    console.log(`[${c.req.method}] ${c.req.path}`);
    await next();
  });
  

// Department Routes
app.route('/departments', departmentRouter);

// Auth Routes
app.route('/auth', authRouter);

// Card Routes
app.route('/cards', cardRouter);
// Submission Routes
app.route('/submissions', submissionRouter);
// File Routes
app.route('/file', fileRouter);
// Users Routes
app.route('/users', usersRoute);
// Activities Routes
app.route('/activities', activitiesRoute);
// Head Routes
app.route('/head', headRoute);

// Health check
app.get('/', (c) => c.text('Pampanga State University Admin Portal API'));

// Start the server
const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`✅ Server is running at http://localhost:${port}`);
