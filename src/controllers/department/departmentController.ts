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
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: {
              where: {
                is_active: true
              }
            },
            cardDepartments: {
              where: {
                card: {
                  status: 'active'
                }
              }
            }
          }
        }
      },
    });

    // Transform to match frontend expectations
    const departmentsWithCounts = departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      created_at: dept.createdAt,
      updated_at: dept.updatedAt,
      _count: {
        users: dept._count.users.length,
        cards: dept._count.cardDepartments.length
      }
    }));

    return c.json(departmentsWithCounts);
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return c.json({ 
      error: 'Failed to fetch departments',
      message: error.message,
      details: 'Check database connection and schema'
    }, 500);
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
          departments: {
            some: {
              departmentId: user.departmentId
            }
          },
          status: 'active'
        },
        include: {
          departments: {
            include: {
              department: true
            }
          },
          files: true,
          head: {
            select: {
              first_name: true,
              last_name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Transform the data to match frontend expectations
      const transformedCards = cards.map(card => ({
        ...card,
        department: card.departments[0]?.department || null // Take first department for compatibility
      }));

      return c.json(transformedCards);
    }

    // For staff - get cards from their department
    if (user.user_type === 'STAFF') {
      if (!user.departmentId) {
        return c.json({ error: 'No department assigned' }, 400);
      }

      const cards = await prisma.card.findMany({
        where: {
          departments: {
            some: {
              departmentId: user.departmentId
            }
          },
          status: 'active'
        },
        include: {
          departments: {
            include: {
              department: true
            }
          },
          files: true,
          head: {
            select: {
              first_name: true,
              last_name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const transformedCards = cards.map(card => ({
        ...card,
        department: card.departments[0]?.department || null
      }));

      return c.json(transformedCards);
    }

    // For admin - get all active cards
    if (user.user_type === 'ADMIN') {
      const cards = await prisma.card.findMany({
        where: {
          status: 'active'
        },
        include: {
          departments: {
            include: {
              department: true
            }
          },
          files: true,
          head: {
            select: {
              first_name: true,
              last_name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const transformedCards = cards.map(card => ({
        ...card,
        department: card.departments[0]?.department || null
      }));

      return c.json(transformedCards);
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
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: {
              where: {
                is_active: true
              }
            },
            cardDepartments: {
              where: {
                card: {
                  status: 'active'
                }
              }
            }
          }
        }
      },
    });

    if (!department) {
      return c.json({ error: 'Department not found' }, 404);
    }

    const departmentWithCounts = {
      id: department.id,
      name: department.name,
      code: department.code,
      description: department.description,
      created_at: department.createdAt,
      updated_at: department.updatedAt,
      _count: {
        users: department._count.users.length,
        cards: department._count.cardDepartments.length
      }
    };

    return c.json(departmentWithCounts);
  } catch (error: any) {
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

    // Simple approach - get basic department info first
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
        _count: {
          select: {
            cardDepartments: {
              where: {
                card: {
                  status: 'active'
                }
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Process department data - simplified version
    const departmentStorage = departments.map(dept => {
      const staffCount = dept.users.length;
      const totalCards = dept._count.cardDepartments;

      // For now, return basic data without complex calculations
      return {
        department: dept.name,
        staffCount,
        totalCards,
        totalSubmissions: 0, // Placeholder
        completedCards: 0,   // Placeholder  
        pendingCards: totalCards, // Placeholder
        completionRate: 0,   // Placeholder
        totalFiles: 0,       // Placeholder
        totalStorage: '0 Bytes', // Placeholder
        storageUsed: 0,      // Placeholder
        storagePercentage: 0 // Placeholder
      };
    });

    return c.json(departmentStorage, 200);

  } catch (error) {
    console.error('Error fetching department storage:', error);
    return c.json({ 
      error: 'Failed to fetch department storage data',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: 'This endpoint is being updated for the new schema'
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
              in: ['STAFF', 'HEAD']
            }
          }
        },
        cardDepartments: {
          include: {
            card: {
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
        }
      }
    });

    if (!department) {
      return c.json({ error: 'Department not found' }, 404);
    }

    const staffCount = department.users.length;
    const activeCards = department.cardDepartments.map(cd => cd.card).filter(Boolean);
    
    const totalSubmissions = activeCards.reduce((sum, card) => {
      return sum + (card?.submissions.length || 0);
    }, 0);

    let completedCards = 0;
    let pendingCards = 0;

    activeCards.forEach(card => {
      if (!card) return;
      
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
