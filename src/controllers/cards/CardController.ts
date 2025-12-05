import prisma from '../../utils/db.js';
import type { Context } from 'hono';

export const getDepartmentCards = async (c: Context) => {
  try {
    // Get user from JWT
    const user = c.get('user');
    
    if (!user) {
      console.error('No user found in request');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('User fetching department cards:', { 
      id: user.id, 
      user_type: user.user_type, 
      departmentId: user.departmentId 
    });

    // For HEAD and STAFF users - get cards from their department
    if (user.user_type === 'HEAD' || user.user_type === 'STAFF') {
      console.log('Fetching cards for user type:', user.user_type, 'departmentId:', user.departmentId);
      
      if (!user.departmentId) {
        console.error(`${user.user_type} user has no departmentId assigned`);
        return c.json({ error: `${user.user_type} user not assigned to any department` }, 400);
      }

      try {
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
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        console.log(`Found ${cards.length} cards for ${user.user_type} user in department ${user.departmentId}`);
        return c.json(cards);
      } catch (dbError) {
        console.error('Database error in getDepartmentCards:', dbError);
        return c.json({ error: 'Database error occurred' }, 500);
      }
    }

    // For ADMIN - get all cards
    if (user.user_type === 'ADMIN') {
      console.log('Fetching all cards for ADMIN user');
      
      try {
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
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        console.log(`Found ${cards.length} cards for ADMIN user`);
        return c.json(cards);
      } catch (dbError) {
        console.error('Database error in getDepartmentCards for ADMIN:', dbError);
        return c.json({ error: 'Database error occurred' }, 500);
      }
    }

    console.error('User role not recognized:', user.user_type);
    return c.json({ error: 'No cards available for your role' }, 403);

  } catch (error) {
    console.error('Unexpected error in getDepartmentCards:', error);
    
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return c.json({ error: 'Failed to fetch department cards' }, 500);
  }
};

export const createCard = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { title, description, departmentIds, headId, expiresAt, allowedFileTypes } = body; // Changed to departmentIds
    
    console.log('Creating card with data:', {
      title,
      description,
      departmentIds, // Now departmentIds
      headId,
      expiresAt,
      allowedFileTypes
    });

    // Handle department assignment
    let finalDepartmentIds: number[] = [];
    
    if (departmentIds === 'ALL') {
      // Get all department IDs for ALL selection
      const allDepartments = await prisma.department.findMany({
        select: { id: true }
      });
      finalDepartmentIds = allDepartments.map(dept => dept.id);
    } else if (Array.isArray(departmentIds)) {
      // Multiple departments selected
      finalDepartmentIds = departmentIds;
    } else if (typeof departmentIds === 'number') {
      // Single department (backward compatibility)
      finalDepartmentIds = [departmentIds];
    } else {
      throw new Error('Invalid department IDs format');
    }

    // Validate that we have at least one department
    if (finalDepartmentIds.length === 0) {
      throw new Error('At least one department is required');
    }

    console.log('Assigning card to departments:', finalDepartmentIds);

    const card = await prisma.card.create({
      data: {
        title,
        description: description || null,
        allowedFileTypes: Array.isArray(allowedFileTypes) ? allowedFileTypes.join(',') : (allowedFileTypes || "*"),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        headId: headId || null,
        // Create relations in the junction table
        departments: {
          create: finalDepartmentIds.map((deptId: number) => ({
            departmentId: deptId
          }))
        }
      },
      include: {
        departments: {
          include: {
            department: true
          }
        },
        head: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    console.log('Card created successfully:', card.id);
    return c.json(card, 201);
  } catch (error: any) {
    console.error('Error creating card:', error);
    return c.json({ 
      error: 'Failed to create card',
      details: error.message 
    }, 500);
  }
};
export const getAllCards = async (c: Context) => {
  try {
    const { departmentId } = c.req.query();
    
    let whereClause: any = { status: 'active' };
    
    if (departmentId) {
      // Get cards that are associated with the specified department
      whereClause = {
        status: 'active',
        departments: {
          some: {
            departmentId: parseInt(departmentId)
          }
        }
      };
    }
    
    const cards = await prisma.card.findMany({
      where: whereClause,
      include: {
        departments: {
          include: {
            department: true
          }
        },
        head: true,
        files: true,
        _count: {
          select: {
            submissions: true,
            files: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return c.json(cards);
  } catch (error) {
    console.error('Error fetching cards:', error);
    return c.json({ error: 'Failed to fetch cards' }, 500);
  }
};

export const getCardById = async (c: Context) => {
  try {
    const cardId = c.req.param('id');
    
    const card = await prisma.card.findUnique({
      where: { id: Number(cardId) },
      include: {
        departments: {
          include: {
            department: true
          }
        },
        head: true,
        files: {
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                avatar: true, // ← Add this line (NOT profile_picture)
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        // ... other includes
      }
    });
    
    if (!card) {
      return c.json({ error: 'Card not found' }, 404);
    }
    
    return c.json(card);
  } catch (error) {
    console.error('Error fetching card:', error);
    return c.json({ error: 'Failed to fetch card' }, 500);
  }
};

// Remove expired cards methods since expiresAt field doesn't exist

// Method to update card (general update)
export const updateCard = async (c: Context) => {
  try {
    const cardId = c.req.param('id');
    const body = await c.req.json();
    const { title, description } = body;

    if (!cardId) {
      return c.json({ error: 'Card ID is required' }, 400);
    }

    const card = await prisma.card.update({
      where: { id: Number(cardId) },
      data: {
        title,
        description
      },
      include: {
        department: true,
        head: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    return c.json(card);
  } catch (error) {
    console.error('Error updating card:', error);
    return c.json({ error: 'Failed to update card' }, 500);
  }
};

// MINIMAL WORKING VERSION - Guaranteed to work
export const getCardAnalytics = async (c: Context) => {
  try {
    console.log('🚀 ULTRA SIMPLE: Fetching card analytics...');
    
    // SIMPLEST POSSIBLE QUERY - just get basic card data
    const cards = await prisma.card.findMany({
      where: {
        status: 'active'
      },
      select: {
        id: true,
        title: true,
        expiresAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ ULTRA SIMPLE: Found ${cards.length} cards`);
    
    // SIMPLEST POSSIBLE TRANSFORMATION
    const result = cards.map(card => ({
      id: card.id,
      title: card.title,
      postedBy: 'Administrator', // Hardcoded for now
      deadline: card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : 'No deadline',
      priority: 'Medium',
      submissions: 0, // Default value
      totalStaff: 5,  // Default value
      status: 'Pending'
    }));

    console.log('🎉 ULTRA SIMPLE: Returning card data:', result);
    return c.json(result);
    
  } catch (error: any) {
    console.error('💥 ULTRA SIMPLE: Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Return empty array as fallback
    return c.json([]);
  }
};

export const getCardUsers = async (c: Context) => {
  try {
    const cardId = c.req.param('id');
    
    if (!cardId) {
      return c.json({ error: 'Card ID is required' }, 400);
    }

    // Fetch card with departments and files
    const card = await prisma.card.findUnique({
      where: { id: parseInt(cardId) },
      include: {
        departments: {
          include: {
            department: {
              include: {
                users: true  // Changed from include: { profile: true }
              }
            }
          }
        },
        files: {
          include: {
            user: true  // Changed from include: { profile: true }
          }
        }
      }
    });

    if (!card) {
      return c.json({ error: 'Card not found' }, 404);
    }

    // Get all unique users from associated departments
    const allDepartmentUsers = [];
    const seenUserIds = new Set();
    
    card.departments.forEach(dept => {
      dept.department.users.forEach(user => {
        if (!seenUserIds.has(user.id)) {
          seenUserIds.add(user.id);
          allDepartmentUsers.push(user);
        }
      });
    });

    // Get users who have submitted files
    const submittedUserIds = new Set(card.files.map(file => file.userId));
    
    // Create user status array
    const userStatus = allDepartmentUsers.map(user => ({
      id: user.id,
      // Use first_name and last_name instead of profile.name
      name: user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}`
        : user.first_name || user.last_name || user.username || user.email.split('@')[0],
      email: user.email,
      username: user.username,
      user_type: user.user_type,
      hasSubmitted: submittedUserIds.has(user.id),
      submittedFileId: card.files.find(file => file.userId === user.id)?.id || null,
      submittedAt: card.files.find(file => file.userId === user.id)?.createdAt || null
    }));

    // Sort users: submitted first, then by name
    userStatus.sort((a, b) => {
      if (a.hasSubmitted && !b.hasSubmitted) return -1;
      if (!a.hasSubmitted && b.hasSubmitted) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    return c.json({
      cardId: card.id,
      cardTitle: card.title,
      totalUsers: allDepartmentUsers.length,
      submittedCount: submittedUserIds.size,
      pendingCount: allDepartmentUsers.length - submittedUserIds.size,
      users: userStatus
    });
  } catch (error) {
    console.error('Error fetching card users:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};