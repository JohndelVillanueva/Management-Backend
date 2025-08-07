import type { Context } from 'hono';
import prisma from '../../utils/db.js';

// Get all departments
export const getAllDepartments = async (c: Context) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            users: true,
            cards: true,
          },
        },
      },
    });

    // Transform the data to match frontend expectations
    const departmentsWithCounts = departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: null, // Temporarily set to null until Prisma client is regenerated
      created_at: dept.createdAt,
      updated_at: dept.updatedAt,
      _count: dept._count,
    }));

    return c.json(departmentsWithCounts);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return c.json({ error: 'Failed to fetch departments' }, 500);
  }
};

export const getDepartmentCards = async (c: Context) => {
  try {
    // Get user from JWT middleware
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // For department heads - get cards from their department
    if (user.user_type === 'HEAD') {
      if (!user.departmentId) {
        return c.json({ error: 'No department assigned' }, 400);
      }

      const cards = await prisma.card.findMany({
        where: {
          departmentId: user.departmentId,
          status: 'active'
        },
        include: {
          department: true,
          files: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return c.json(cards);
    }

    // For staff - get cards from their department
    if (user.user_type === 'STAFF') {
      if (!user.departmentId) {
        return c.json({ error: 'No department assigned' }, 400);
      }

      const cards = await prisma.card.findMany({
        where: {
          departmentId: user.departmentId,
          status: 'active'
        },
        include: {
          department: true,
          files: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return c.json(cards);
    }

    // For admin - get all active cards
    if (user.user_type === 'ADMIN') {
      const cards = await prisma.card.findMany({
        where: {
          status: 'active'
        },
        include: {
          department: true,
          files: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return c.json(cards);
    }

    return c.json({ error: 'Unauthorized access' }, 403);

  } catch (error) {
    console.error('Error fetching department cards:', error);
    return c.json({ error: 'Failed to fetch department cards' }, 500);
  }
};

// Get single department by IDz`
export const getDepartmentById = async (c: Context) => {
  try {
    const { id } = c.req.param();
    const departmentId = parseInt(id);

    if (isNaN(departmentId)) {
      return c.json({ error: 'Invalid department ID' }, 400);
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        _count: {
          select: {
            users: true,
            cards: true,
          },
        },
      },
    });

    if (!department) {
      return c.json({ error: 'Department not found' }, 404);
    }

    const departmentWithCounts = {
      id: department.id,
      name: department.name,
      code: department.code,
      description: null, // Temporarily set to null until Prisma client is regenerated
      created_at: department.createdAt,
      updated_at: department.updatedAt,
      users: [],
      cards: [],
      _count: department._count,
    };

    return c.json(departmentWithCounts);
  } catch (error) {
    console.error('Error fetching department:', error);
    return c.json({ error: 'Failed to fetch department' }, 500);
  }
};

// Create new department
export const createDepartment = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, description, code } = body;

    if (!name || !name.trim()) {
      return c.json({ error: 'Department name is required' }, 400);
    }

    if (!code || !code.trim()) {
      return c.json({ error: 'Department code is required' }, 400);
    }

    // Check if department with same name already exists
    const existingDepartmentByName = await prisma.department.findFirst({
      where: {
        name: name.trim(),
      },
    });

    if (existingDepartmentByName) {
      return c.json({ error: 'Department with this name already exists' }, 400);
    }

    // Check if department with same code already exists
    const existingDepartmentByCode = await prisma.department.findFirst({
      where: {
        code: code.trim(),
      },
    });

    if (existingDepartmentByCode) {
      return c.json({ error: 'Department with this code already exists' }, 400);
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        code: code.trim(),
        // description: description?.trim() || null, // Temporarily commented out
      },
      include: {
        _count: {
          select: {
            users: true,
            cards: true,
          },
        },
      },
    });

    const departmentWithCounts = {
      id: department.id,
      name: department.name,
      code: department.code,
      description: null, // Temporarily set to null until Prisma client is regenerated
      created_at: department.createdAt,
      updated_at: department.updatedAt,
      _count: department._count,
    };

    return c.json(departmentWithCounts, 201);
  } catch (error) {
    console.error('Error creating department:', error);
    return c.json({ error: 'Failed to create department' }, 500);
  }
};

// Update department
export const updateDepartment = async (c: Context) => {
  try {
    const { id } = c.req.param();
    const departmentId = parseInt(id);
    const body = await c.req.json();
    const { name, description, code } = body;

    if (isNaN(departmentId)) {
      return c.json({ error: 'Invalid department ID' }, 400);
    }

    if (!name || !name.trim()) {
      return c.json({ error: 'Department name is required' }, 400);
    }

    if (!code || !code.trim()) {
      return c.json({ error: 'Department code is required' }, 400);
    }

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!existingDepartment) {
      return c.json({ error: 'Department not found' }, 404);
    }

    // Check if another department with same name already exists
    const duplicateDepartmentByName = await prisma.department.findFirst({
      where: {
        name: name.trim(),
        id: {
          not: departmentId,
        },
      },
    });

    if (duplicateDepartmentByName) {
      return c.json({ error: 'Department with this name already exists' }, 400);
    }

    // Check if another department with same code already exists
    const duplicateDepartmentByCode = await prisma.department.findFirst({
      where: {
        code: code.trim(),
        id: {
          not: departmentId,
        },
      },
    });

    if (duplicateDepartmentByCode) {
      return c.json({ error: 'Department with this code already exists' }, 400);
    }

    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId },
      data: {
        name: name.trim(),
        code: code.trim(),
        // description: description?.trim() || null, // Temporarily commented out
      },
      include: {
        _count: {
          select: {
            users: true,
            cards: true,
          },
        },
      },
    });

    const departmentWithCounts = {
      id: updatedDepartment.id,
      name: updatedDepartment.name,
      code: updatedDepartment.code,
      description: null, // Temporarily set to null until Prisma client is regenerated
      created_at: updatedDepartment.createdAt,
      updated_at: updatedDepartment.updatedAt,
      _count: updatedDepartment._count,
    };

    return c.json(departmentWithCounts);
  } catch (error) {
    console.error('Error updating department:', error);
    return c.json({ error: 'Failed to update department' }, 500);
  }
};

// Delete department
export const deleteDepartment = async (c: Context) => {
  try {
    const { id } = c.req.param();
    const departmentId = parseInt(id);

    if (isNaN(departmentId)) {
      return c.json({ error: 'Invalid department ID' }, 400);
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return c.json({ error: 'Department not found' }, 404);
    }

    await prisma.department.delete({
      where: { id: departmentId },
    });

    return c.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    return c.json({ error: 'Failed to delete department' }, 500);
  }
}; 