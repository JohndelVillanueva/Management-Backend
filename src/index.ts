import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import authRouter from './routes/auth.route.js';
import prisma from './utils/db.js';
// import departmentRoutes from './routes/department.routes.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', async (c, next) => {
  try {
    await next();
  } finally {
    await prisma.$disconnect();
  }
});

// Department Routes
// app.route('/getDepartment', departmentRoutes);

// Auth Routes
app.route('/auth', authRouter);

// Health check
app.get('/', (c) => c.text('Pampanga State University Admin Portal API'));

// Start the server
const port = Number(process.env.PORT);
serve({ fetch: app.fetch, port });
console.log(`✅ Server is running at http://localhost:${port}`);
