import prisma from '../../utils/db.js';
import type { Context } from 'hono';

export const getDepartmentCards = async (c: Context) => {
  try {
    // Get user from JWT (assuming you have authentication middleware)
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Calculate current date for expiration filtering
    const currentDate = new Date();

    // For department heads - get cards assigned to their department
    if (user.user_type === 'HEAD') {
      const cards = await prisma.card.findMany({
        where: {
          departmentId: user.departmentId,
          status: 'active', // Only show active cards
          // Only show cards that are not expired OR have no expiration date
          OR: [
            { expiresAt: null }, // Cards with no expiration
            { expiresAt: { gt: currentDate } } // Cards that haven't expired yet
          ]
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
      return c.json(cards);
    }

    // For staff - get cards from their department
    if (user.user_type === 'STAFF' && user.departmentId) {
      const cards = await prisma.card.findMany({
        where: {
          departmentId: user.departmentId,
          status: 'active',
          // Only show cards that are not expired OR have no expiration date
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: currentDate } }
          ]
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
      return c.json(cards);
    }

    // For admin - get all cards (or filter as needed)
    if (user.user_type === 'ADMIN') {
      const cards = await prisma.card.findMany({
        where: {
          status: 'active',
          // Only show cards that are not expired OR have no expiration date
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: currentDate } }
          ]
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
      return c.json(cards);
    }

    return c.json({ error: 'No cards available for your role' }, 403);

  } catch (error) {
    console.error('Error fetching department cards:', error);
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
    console.log('User creating card:', { userId: user.id, userType: user.user_type, userDepartment: user.departmentId });
    
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

    // Validate expiration date if provided
    if (expiresAt) {
      const expirationDate = new Date(expiresAt);
      console.log('Parsed expiration date:', expirationDate);
      console.log('Is valid date?', !isNaN(expirationDate.getTime()));
      console.log('Is future date?', expirationDate > new Date());
      
      if (isNaN(expirationDate.getTime())) {
        return c.json({ error: 'Invalid expiration date format' }, 400);
      }
      
      // Check if expiration date is in the future
      if (expirationDate <= new Date()) {
        return c.json({ error: 'Expiration date must be in the future' }, 400);
      }
    }

    const cardData: any = { 
      title, 
      description, 
      departmentId: finalDepartmentId,
      headId: finalHeadId,
    };

    // Only add expiresAt if it's provided and valid
    if (expiresAt) {
      cardData.expiresAt = new Date(expiresAt);
    }

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
    
    const currentDate = new Date();
    const where: any = { status: 'active' };
    
    // Handle expiration filtering
    if (includeExpired === 'false') {
      // Exclude expired cards (default behavior)
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: currentDate } }
      ];
    } else if (includeExpired === 'only') {
      // Only get expired cards
      where.expiresAt = { lte: currentDate };
    }
    // If includeExpired is 'true', show all cards regardless of expiration
    
    if (userId) {
      where.OR = [
        { headId: Number(userId) }
      ];
      
      if (departmentId) {
        where.OR.push({
          departmentId: Number(departmentId)
        });
      }
    }
    
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
    
    return c.json(cards, 200);
  } catch (error) {
    console.error('Error fetching cards:', error);
    return c.json({ error: 'Failed to fetch cards.' }, 500);
  }
};

export const getCardById = async (c: Context) => {
  try {
    const cardId = c.req.param('id');
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

    // Check if card is expired (but still return it)
    if (card.expiresAt && card.expiresAt <= new Date()) {
      // You might want to add an 'isExpired' flag to the response
      const cardWithExpirationFlag = {
        ...card,
        isExpired: true
      };
      return c.json(cardWithExpirationFlag);
    }

    return c.json(card);
  } catch (error) {
    console.error('Error fetching card:', error);
    return c.json({ error: 'Failed to fetch card' }, 500);
  }
};

// New method to get expired cards (for admin/cleanup purposes)
export const getExpiredCards = async (c: Context) => {
  try {
    const user = c.get('user');
    
    if (!user || user.user_type !== 'ADMIN') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const currentDate = new Date();
    const expiredCards = await prisma.card.findMany({
      where: {
        status: 'active',
        expiresAt: {
          lte: currentDate
        }
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
        expiresAt: 'desc'
      }
    });

    return c.json(expiredCards);
  } catch (error) {
    console.error('Error fetching expired cards:', error);
    return c.json({ error: 'Failed to fetch expired cards' }, 500);
  }
};

// Method to update card expiration date
export const updateCardExpiration = async (c: Context) => {
  try {
    const cardId = c.req.param('id');
    const body = await c.req.json();
    const { expiresAt } = body;

    // Validate expiration date if provided
    if (expiresAt) {
      const expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return c.json({ error: 'Invalid expiration date format' }, 400);
      }
      
      if (expirationDate <= new Date()) {
        return c.json({ error: 'Expiration date must be in the future' }, 400);
      }
    }

    const card = await prisma.card.update({
      where: { id: Number(cardId) },
      data: {
        expiresAt: expiresAt ? new Date(expiresAt) : null
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
    console.error('Error updating card expiration:', error);
    return c.json({ error: 'Failed to update card expiration' }, 500);
  }
};