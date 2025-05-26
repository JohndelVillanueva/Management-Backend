// // app/services/departmentService.ts
// import { PrismaClient } from '../generated/prisma/index.js';

// const prisma = new PrismaClient();


// export const getAllDepartments = async () => {
//   return await prisma.department.findMany({
//     select: {
//       id: true,
//       name: true,
//     },
//     orderBy: {
//       name: 'asc',
//     },
//   });
// };

// export const createDepartment = async (name: string, description?: string) => {
//   return await prisma.department.create({
//     data: {
//       name,
//       description,
//     },
//   });
// };