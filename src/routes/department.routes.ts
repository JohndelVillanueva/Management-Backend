import { Hono } from 'hono';
import { 
  getAllDepartments, 
  getDepartmentById, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment 
} from '../controllers/department/departmentController.js';

const departmentRouter = new Hono();

// Get all departments
departmentRouter.get('/', getAllDepartments);

// Get single department by ID
departmentRouter.get('/:id', getDepartmentById);

// Create new department
departmentRouter.post('/', createDepartment);

// Update department
departmentRouter.put('/:id', updateDepartment);

// Delete department
departmentRouter.delete('/:id', deleteDepartment);

export default departmentRouter; 