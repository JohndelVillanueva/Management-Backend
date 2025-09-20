import type { Context } from 'hono';
import prisma from '../../utils/db.js';

// Test endpoint to check database connection
export const testConnection = async (c: Context) => {
  try {
    const userCount = await prisma.user.count();
    return c.json({ 
      success: true, 
      message: 'Database connection successful',
      userCount 
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
};

// GET /users → return all users (with department filtering for HEAD users)
export const getAllUsers = async (c: Context) => {
  try {
    // Get authenticated user from context (set by auth middleware)
    const authUser = c.get("user");
    const userType = authUser?.userType;
    const userDepartmentId = authUser?.departmentId;

    console.log("Users Controller - Auth User:", {
      userType,
      userDepartmentId,
      fullAuthUser: authUser
    });

    // Build where clause based on user type
    let whereClause: any = {};
    
    // If user is HEAD, only show staff from their department
    if ((userType === 'HEAD' || userType === 'DepartmentHead') && userDepartmentId) {
      whereClause = {
        user_type: 'STAFF',
        departmentId: userDepartmentId
      };
      console.log("Users Controller - HEAD user filtering:", whereClause);
    } else if (userType === 'ADMIN' || userType === 'Admin') {
      console.log("Users Controller - ADMIN user, no filtering applied");
    } else if ((userType === 'HEAD' || userType === 'DepartmentHead') && !userDepartmentId) {
      console.log("Users Controller - HEAD user has no department assigned");
      return c.json({ error: 'No department assigned to user' }, 400);
    }
    // If user is ADMIN, show all users (no filtering)
    // If user is STAFF, they shouldn't access this endpoint (handled by route protection)

    console.log("Users Controller - Executing Prisma query with whereClause:", whereClause);
    
    const users = await prisma.user.findMany({
      where: whereClause,
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
    
    console.log("Users Controller - Prisma query successful, found users:", users.length);

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

    console.log("Users Controller - Returning users:", {
      totalUsers: withAvatars.length,
      userTypes: withAvatars.map(u => ({ id: u.id, user_type: u.user_type, department: u.department?.name }))
    });

    return c.json(withAvatars, 200);
  } catch (error) {
    console.error('Error fetching users:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      authUser: c.get("user")
    });
    return c.json({ 
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};
