// import type { Context } from 'hono';
// import { getAllDepartments } from '../../services/departmentServices.js';

// export const getDepartments = async (c: Context): Promise<Response> => {
//   try {
//     const departments = await getAllDepartments();
//     return c.json({
//       success: true,
//       data: departments,
//     });
//   } catch (error) {
//     console.error(`[${new Date().toISOString()}] DepartmentController.getDepartments error:`, error);
//     return c.json(
//       {
//         success: false,
//         message: 'Failed to fetch departments',
//         error: error instanceof Error ? error.message : 'Unknown error',
//       },
//       500
//     );
//   }
// };
