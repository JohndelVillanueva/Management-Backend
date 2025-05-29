import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import authRouter from './routes/auth.route.js';
// import prisma from './utils/db.js';
import { departmentRouter } from './controllers/department/index.js';
import 'dotenv/config'; 

const app = new Hono();

// Middleware
app.use('*',   cors({
    origin: 'http://localhost:5173', // Specific origin, not '*'
    credentials: true,               // Important: allow credentials (cookies)
  }));

// Department Routes
app.route('/departments', departmentRouter);

// Auth Routes
app.route('/auth', authRouter);

// Health check
app.get('/', (c) => c.text('Pampanga State University Admin Portal API'));

// Start the server
const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`✅ Server is running at http://localhost:${port}`);
