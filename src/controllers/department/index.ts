// src/controllers/departments.ts
import { Hono } from 'hono';
import prisma from "../../utils/db.js";
const departmentRouter = new Hono();

// Get all departments
departmentRouter.get('/', async (c) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return c.json({
      success: true,
      data: departments,
      count: departments.length,
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return c.json(
      {
        success: false,
        message: 'asds',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// Get single department by ID
// departmentRouter.get('/:id', async (c) => {
//   const id = parseInt(c.req.param('id'));

//   if (isNaN(id)) {
//     return c.json(
//       {
//         success: false,
//         message: 'Invalid department ID',
//       },
//       400
//     );
//   }

//   try {
//     const department = await prisma.department.findUnique({
//       where: { id },
//     });

//     if (!department) {
//       return c.json(
//         {
//           success: false,
//           message: 'Department not found',
//         },
//         404
//       );
//     }

//     return c.json({
//       success: true,
//       data: department,
//     });
//   } catch (error) {
//     console.error('Error fetching department:', error);
//     return c.json(
//       {
//         success: false,
//         message: 'Failed to fetch department',
//         error: error instanceof Error ? error.message : 'Unknown error',
//       },
//       500
//     );
//   }
// });

export { departmentRouter };