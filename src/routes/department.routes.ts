// src/routes/department.routes.ts
import { Hono } from 'hono';
import { 
  getAllDepartments, 
  getDepartmentById, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment,
  getDepartmentStorage,
  getDepartmentStorageById
} from '../controllers/department/departmentController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const departmentRouter = new Hono()

departmentRouter
  .get('/', getAllDepartments)
  .get('/storage', authMiddleware, getDepartmentStorage)
  .get('/storage/:id', authMiddleware, getDepartmentStorageById)
  .get('/:id', getDepartmentById)
  .post('/', authMiddleware, createDepartment)
  .put('/:id', authMiddleware, updateDepartment)
  .delete('/:id', authMiddleware, deleteDepartment);

export default departmentRouter;