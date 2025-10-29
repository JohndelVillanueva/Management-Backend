// Updated departmentRouter with storage routes
// File: routes/departmentRoutes.ts (or wherever your route file is)

import { Hono } from 'hono';
import { 
  getAllDepartments, 
  getDepartmentById, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment,
  getDepartmentCards,
  getDepartmentStorage,        // Add this import
  getDepartmentStorageById     // Add this import
} from '../controllers/department/departmentController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const departmentRouter = new Hono()

// Get all departments
.get('/', getAllDepartments)

// ✅ NEW: Get department storage data for all departments
.get('/storage', getDepartmentStorage)

// Get single department by ID
.get('/:id', getDepartmentById)

// ✅ NEW: Get storage for a specific department
.get('/:id/storage', getDepartmentStorageById)

// Get cards for a department
.get('/:id/cards', getDepartmentCards)

// Create new department
.post('/', authMiddleware, createDepartment)

// Update department
.put('/:id', authMiddleware, updateDepartment)

// Delete department
.delete('/:id', authMiddleware, deleteDepartment)

export default departmentRouter;

/*
===========================================
HOW TO USE THESE ROUTES:
===========================================

1. GET /departments/storage
   - Returns storage data for ALL departments
   - No authentication required (add authMiddleware if needed)
   
2. GET /departments/5/storage
   - Returns detailed storage data for department with ID 5
   - Includes list of cards with submission counts

Example requests:
-----------------
// Get all department storage
fetch('http://localhost:3000/departments/storage', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

// Get specific department storage
fetch('http://localhost:3000/departments/5/storage', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

===========================================
*/