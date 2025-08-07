import { Hono } from 'hono';
import { 
  getAllDepartments, 
  getDepartmentById, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment,
  getDepartmentCards
} from '../controllers/department/departmentController.js';

const departmentRouter = new Hono()

// Get all departments
.get('/', getAllDepartments)

// Get single department by ID
.get('/:id', getDepartmentById)

// Create new department
.post('/', createDepartment)

// Update department
.put('/:id', updateDepartment)

// Delete department
.delete('/:id', deleteDepartment)

 .get('/:id/cards', getDepartmentCards) // Add this new route

export default departmentRouter; 