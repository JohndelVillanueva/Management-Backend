import type { Context } from 'hono';
import prisma from '../../utils/db.js';

// GET /users → return all users
export const getAllUsers = async (c: Context) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        user_type: true,
        is_active: true,
        is_verified: true,
        created_at: true,
        avatar: true,
        department: {
          select: { name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const origin = new URL(c.req.url).origin;
    const toAbsolute = (p?: string | null) => {
      if (!p) return null;
      if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
      return `${origin}${p.startsWith('/') ? '' : '/'}${p}`;
    };

    const withAvatars = users.map((u) => ({
      ...u,
      avatar: toAbsolute(u.avatar ?? null),
    }));

    return c.json(withAvatars, 200);
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
};
