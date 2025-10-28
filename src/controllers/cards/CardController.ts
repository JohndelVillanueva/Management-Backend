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
            departmentId: user.departmentId,
            status: 'active'
          },
          include: {
            department: true,
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
            department: true,
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
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return c.json({ error: 'Failed to fetch department cards' }, 500);
  }
};

// Your existing controller methods
export const createCard = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { title, description, departmentId, headId, expiresAt } = body;
    
    // Get user from JWT
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('Received data:', { title, description, departmentId, headId, expiresAt });
    
    if (!title) {
      return c.json({ error: 'Title is required.' }, 400);
    }

    // For HEAD users, they can only create cards for their own department
    let finalDepartmentId: number;
    if (user.user_type === 'HEAD') {
      if (!user.departmentId) {
        return c.json({ error: 'Head user must be assigned to a department to create cards' }, 400);
      }
      finalDepartmentId = user.departmentId;
      console.log('Head user creating card for their department:', finalDepartmentId);
    } else if (user.user_type === 'ADMIN') {
      // Admin can specify department, but it's required
      if (!departmentId) {
        return c.json({ error: 'departmentId is required for admin users' }, 400);
      }
      finalDepartmentId = Number(departmentId);
    } else {
      return c.json({ error: 'Only admin and head users can create cards' }, 403);
    }

    // For HEAD users, they are automatically assigned as the head of the card
    let finalHeadId: number | null = null;
    if (user.user_type === 'HEAD') {
      finalHeadId = user.id;
      console.log('Automatically assigning head user as card head:', finalHeadId);
    } else if (user.user_type === 'ADMIN' && headId) {
      // Admin can specify a head, but validate it exists and is a HEAD
      const headUser = await prisma.user.findUnique({
        where: { 
          id: Number(headId),
          user_type: 'HEAD'
        }
      });
      if (!headUser) {
        return c.json({ error: 'Head user not found or not a department head' }, 404);
      }
      finalHeadId = Number(headId);
    }

    // FIX: Include expiresAt in the card data
    const cardData: any = { 
      title, 
      description, 
      departmentId: finalDepartmentId,
      headId: finalHeadId,
      expiresAt: expiresAt ? new Date(expiresAt) : null, // Add this line
    };

    console.log('Creating card with data:', cardData);

    const card = await prisma.card.create({
      data: cardData,
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

    console.log('Created card:', card);

    return c.json(card, 201);
  } catch (error) {
    console.error('Error creating card:', error);
    return c.json({ error: 'Failed to create card.' }, 500);
  }
};

export const getAllCards = async (c: Context) => {
  try {
    const { userId, departmentId, includeExpired = 'false' } = c.req.query();
    
    console.log('Fetching all cards with params:', { userId, departmentId, includeExpired });
    
    const where: any = { status: 'active' };
    
    let andConditions: any[] = [];

    // Remove expiration filtering since expiresAt field doesn't exist

    // Build user/department conditions
    if (userId) {
      const orConditions: any[] = [{ headId: Number(userId) }];
      if (departmentId) {
        orConditions.push({ departmentId: Number(departmentId) });
      }
      andConditions.push({ OR: orConditions });
    } else if (departmentId) {
      andConditions.push({ departmentId: Number(departmentId) });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
    
    console.log('Final Prisma where clause:', JSON.stringify(where, null, 2));
    
    const cards = await prisma.card.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        department: true,
        files: true,
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
    
    console.log(`Found ${cards.length} cards total`);
    return c.json(cards, 200);
  } catch (error) {
    console.error('Error fetching cards:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return c.json({ error: 'Failed to fetch cards.' }, 500);
  }
};

export const getCardById = async (c: Context) => {
  try {
    const cardId = c.req.param('id');
    
    if (!cardId) {
      return c.json({ error: 'Card ID is required' }, 400);
    }
    
    console.log('Fetching card with ID:', cardId);
    
    const card = await prisma.card.findUnique({
      where: { id: Number(cardId) },
      include: {
        department: true,
        files: true,
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

// Add this to your CardController.ts
export const getCardAnalytics = async (c: Context) => {
  try {
    console.log('Fetching card analytics data...');
    
    const cards = await prisma.card.findMany({
      where: {
        status: 'active',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        department: {
          include: {
            users: {
              where: {
                user_type: { in: ['STAFF', 'HEAD'] },
                is_active: true
              }
            }
          }
        },
        submissions: {
          select: {
            id: true
          }
        },
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

    console.log(`Found ${cards.length} cards for analytics`);

    const formattedCards = cards.map(card => {
      const totalStaffInDepartment = card.department.users.length;
      const submissionCount = card.submissions.length;
      
      console.log(`Card ${card.id}: ${submissionCount} submissions, ${totalStaffInDepartment} staff in department`);

      // Calculate status based on submissions and expiration
      let status = 'Pending';
      if (submissionCount === totalStaffInDepartment && totalStaffInDepartment > 0) {
        status = 'Completed';
      } else if (card.expiresAt && new Date() > new Date(card.expiresAt)) {
        status = 'Overdue';
      } else if (submissionCount > 0) {
        status = 'In Progress';
      }

      // Calculate priority based on expiration date
      let priority = 'Medium';
      if (card.expiresAt) {
        const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (new Date(card.expiresAt) < new Date()) {
          priority = 'Urgent';
        } else if (new Date(card.expiresAt) < sevenDaysFromNow) {
          priority = 'High';
        }
      }

      return {
        id: card.id,
        title: card.title,
        postedBy: card.head ? `${card.head.first_name} ${card.head.last_name}` : 'Unknown',
        deadline: card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : 'No deadline',
        priority: priority,
        submissions: submissionCount,
        totalStaff: totalStaffInDepartment,
        status: status
      };
    });

    return c.json(formattedCards);
  } catch (error) {
    console.error('Error fetching card analytics:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
};