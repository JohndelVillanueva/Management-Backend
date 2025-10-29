import type { Context } from 'hono';
import prisma from '../../utils/db.js';

// Helper to get client IP safely
// ✅ Helper to safely get client IP
const getClientIp = (c: Context): string | null => {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0] || // behind proxy/load balancer
    (c.req.raw as any)?.socket?.remoteAddress ||      // Node's native socket
    null
  );
};

// Get all departments
export const getAllDepartments = async (c: Context) => {
  try {
    const clientIp = getClientIp(c);
    console.log(`Client IP: ${clientIp} - getAllDepartments`);

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
    const clientIp = getClientIp(c);
    console.log(`Client IP: ${clientIp} - getDepartmentCards`);

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

// Get single department by ID
export const getDepartmentById = async (c: Context) => {
  try {
    const clientIp = getClientIp(c);
    console.log(`Client IP: ${clientIp} - getDepartmentById`);

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

export const createDepartment = async (c: Context) => {
  try {
    const clientIp = getClientIp(c);
    console.log(`Client IP: ${clientIp} - createDepartment`);

    // ✅ Get authenticated user from context (set by auth middleware)
    const authUser = c.get("user");
    const userIdFromToken = authUser?.userId || authUser?.id;

    if (!userIdFromToken) {
      return c.json({ error: "Unauthorized - no valid user in token" }, 401);
    }

    const body = await c.req.json();
    console.log("Request body:", body);

    const { name, description, code } = body; // userId is NOT taken from body anymore

    // ✅ Validation
    if (!name || !name.trim()) {
      return c.json({ error: "Department name is required" }, 400);
    }

    if (!code || !code.trim()) {
      return c.json({ error: "Department code is required" }, 400);
    }

    const existingDepartmentByName = await prisma.department.findFirst({
      where: { name: name.trim() },
    });

    if (existingDepartmentByName) {
      return c.json(
        { error: "Department with this name already exists" },
        400
      );
    }

    const existingDepartmentByCode = await prisma.department.findFirst({
      where: { code: code.trim() },
    });

    if (existingDepartmentByCode) {
      return c.json(
        { error: "Department with this code already exists" },
        400
      );
    }

    // ✅ Create Department
    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        code: code.trim(),
        description: description?.trim() || null,
      },
      include: {
        _count: { select: { users: true, cards: true } },
      },
    });

    // ✅ Store activity log in activities table
    await prisma.activity.create({
      data: {
        userId: userIdFromToken, // taken from token
        action: "create",
        resourceType: "department",
        resourceId: department.id,
        description: `Created department "${department.name}" with code "${department.code}"`,
        ipAddress: clientIp,
        userAgent: c.req.header("user-agent") || null,
      },
    });

    const departmentWithCounts = {
      id: department.id,
      name: department.name,
      code: department.code,
      description: department.description,
      created_at: department.createdAt,
      updated_at: department.updatedAt,
      _count: department._count,
    };

    return c.json(departmentWithCounts, 201);
  } catch (error: any) {
    console.error("Error creating department:", error);
    return c.json(
      { error: "Failed to create department", details: error.message },
      500
    );
  }
};

// Update department
export const updateDepartment = async (c: Context) => {
  try {
    const clientIp = getClientIp(c);
    console.log(`Client IP: ${clientIp} - updateDepartment`);

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
    const clientIp = getClientIp(c);
    console.log(`Client IP: ${clientIp} - deleteDepartment`);

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

// Get department storage data for all departments
export const getDepartmentStorage = async (c: Context) => {
  try {
    const clientIp = getClientIp(c);
    console.log(`Client IP: ${clientIp} - getDepartmentStorage`);

    // Fetch all departments with their related data
    const departments = await prisma.department.findMany({
      include: {
        users: {
          where: {
            is_active: true,
            user_type: {
              in: ['STAFF', 'HEAD']  
            },
          }
        },
        cards: {
          where: {
            status: 'active'
          },
          include: {
            submissions: {
              where: {
                status: 'active'
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Process department data
    const departmentStorage = departments.map(dept => {
      const staffCount = dept.users.length;
      const activeCards = dept.cards;
      
      // Calculate total submissions across all cards in the department
      const totalSubmissions = activeCards.reduce((sum, card) => {
        return sum + card.submissions.length;
      }, 0);

      // Count completed and pending cards
      let completedCards = 0;
      let pendingCards = 0;

      activeCards.forEach(card => {
        const expectedSubmissions = staffCount;
        const actualSubmissions = card.submissions.length;

        if (actualSubmissions >= expectedSubmissions && expectedSubmissions > 0) {
          completedCards++;
        } else {
          pendingCards++;
        }
      });

      // Calculate completion rate
      const totalCards = activeCards.length;
      const completionRate = totalCards > 0
        ? Math.round((completedCards / totalCards) * 100)
        : 0;

      return {
        department: dept.name,
        totalSubmissions,
        staffCount,
        completedCards,
        pendingCards,
        completionRate
      };
    });

    return c.json(departmentStorage, 200);

  } catch (error) {
    console.error('Error fetching department storage:', error);
    return c.json({ 
      error: 'Failed to fetch department storage data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};

// Get storage for a specific department by ID
export const getDepartmentStorageById = async (c: Context) => {
  try {
    const clientIp = getClientIp(c);
    console.log(`Client IP: ${clientIp} - getDepartmentStorageById`);

    const { id } = c.req.param();
    const departmentId = parseInt(id);

    if (isNaN(departmentId)) {
      return c.json({ error: 'Invalid department ID' }, 400);
    }

    const department = await prisma.department.findUnique({
      where: {
        id: departmentId
      },
      include: {
        users: {
          where: {
            is_active: true,
            user_type: {
              in: ['STAFF', 'HEAD']  // Include both STAFF and HEAD
            }
          }
        },
        cards: {
          where: {
            status: 'active'
          },
          include: {
            submissions: {
              where: {
                status: 'active'
              },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                    first_name: true,
                    last_name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!department) {
      return c.json({ error: 'Department not found' }, 404);
    }

    const staffCount = department.users.length;
    const activeCards = department.cards;
    
    const totalSubmissions = activeCards.reduce((sum, card) => {
      return sum + card.submissions.length;
    }, 0);

    let completedCards = 0;
    let pendingCards = 0;

    activeCards.forEach(card => {
      const expectedSubmissions = staffCount;
      const actualSubmissions = card.submissions.length;

      if (actualSubmissions >= expectedSubmissions && expectedSubmissions > 0) {
        completedCards++;
      } else {
        pendingCards++;
      }
    });

    const totalCards = activeCards.length;
    const completionRate = totalCards > 0
      ? Math.round((completedCards / totalCards) * 100)
      : 0;

    return c.json({
      department: department.name,
      departmentCode: department.code,
      totalSubmissions,
      staffCount,
      completedCards,
      pendingCards,
      completionRate,
      cards: activeCards.map(card => ({
        id: card.id,
        title: card.title,
        submissions: card.submissions.length,
        expectedSubmissions: staffCount,
        status: card.submissions.length >= staffCount && staffCount > 0 ? 'Completed' : 'Pending',
        expiresAt: card.expiresAt,
        createdAt: card.createdAt
      }))
    }, 200);

  } catch (error) {
    console.error('Error fetching department storage by ID:', error);
    return c.json({ 
      error: 'Failed to fetch department storage data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};
