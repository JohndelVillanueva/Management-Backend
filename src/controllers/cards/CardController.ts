import prisma from '../../utils/db.js';
import type { Context } from 'hono';

export const createCard = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { title, description, departmentId } = body;
    if (!title || !departmentId) {
      return c.json({ error: 'Title and departmentId are required.' }, 400);
    }
    const card = await prisma.card.create({
      data: { title, description, departmentId },
    });
    return c.json(card, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create card.' }, 500);
  }
};

export const getAllCards = async (c: Context) => {
  try {
    const cards = await prisma.card.findMany({ orderBy: { createdAt: 'desc' }, include: { department: true } });
    return c.json(cards, 200);
  } catch (error) {
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
        files: true  // Make sure this matches your Prisma model
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