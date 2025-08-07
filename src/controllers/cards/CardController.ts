import prisma from '../../utils/db.js';
import type { Context } from 'hono';

export const getDepartmentCards = async (c: Context) => {
  try {
    // Get user from JWT (assuming you have authentication middleware)
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // For department heads - get cards assigned to their department
    if (user.user_type === 'HEAD') {
      const cards = await prisma.card.findMany({
        where: {
          departmentId: user.departmentId,
          status: 'active' // Only show active cards
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
    if (user.user_type === 'STAFF' && user.departmentId) {
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

    // For admin - get all cards (or filter as needed)
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
    const { title, description, departmentId, headId } = body;
    
    if (!title || !departmentId) {
      return c.json({ error: 'Title and departmentId are required.' }, 400);
    }

    if (headId) {
      const headUser = await prisma.user.findUnique({
        where: { 
          id: Number(headId),
          user_type: 'HEAD'
        }
      });
      if (!headUser) {
        return c.json({ error: 'Head user not found or not a department head' }, 404);
      }
    }

    const card = await prisma.card.create({
      data: { 
        title, 
        description, 
        departmentId: Number(departmentId),
        headId: headId ? Number(headId) : null
      },
    });

    return c.json(card, 201);
  } catch (error) {
    console.error('Error creating card:', error);
    return c.json({ error: 'Failed to create card.' }, 500);
  }
};

export const getAllCards = async (c: Context) => {
  try {
    const { userId, departmentId } = c.req.query();
    
    const where: any = { status: 'active' };
    
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
        files: true
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
        files: true
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