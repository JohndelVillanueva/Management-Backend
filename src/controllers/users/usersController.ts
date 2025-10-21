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

// Enhanced updateUser function with better error handling
export const updateUser = async (c: Context) => {
  console.log('🔵 UPDATE USER ENDPOINT HIT');
  
  try {
    // Get the user ID from URL parameters
    const userIdParam = c.req.param('id');
    console.log('🔵 User ID from params:', userIdParam);

    const userId = parseInt(userIdParam);
    
    if (isNaN(userId)) {
      console.log('🔴 Invalid user ID:', userIdParam);
      return c.json({ 
        success: false, 
        error: 'Invalid user ID format' 
      }, 400);
    }

    // Get authenticated user from context
    const authUser = c.get("user");
    console.log('🔵 Authenticated User Context:', authUser);

    if (!authUser) {
      console.log('🔴 No authenticated user found in context');
      return c.json({ 
        success: false, 
        error: 'Authentication required' 
      }, 401);
    }

    const userType = authUser?.userType;
    const authUserId = authUser?.id;

    console.log("🔵 Update User - Auth Details:", {
      userType,
      authUserId,
      targetUserId: userId,
      authUserDepartment: authUser.departmentId
    });

    // Parse request body
    let updateData;
    try {
      updateData = await c.req.json();
      console.log('🔵 Request Body:', updateData);
    } catch (parseError) {
      console.log('🔴 JSON Parse Error:', parseError);
      return c.json({ 
        success: false, 
        error: 'Invalid JSON in request body' 
      }, 400);
    }

    // Validate required fields
    if (!updateData.first_name || !updateData.last_name || !updateData.email || !updateData.user_type) {
      console.log('🔴 Missing required fields:', {
        first_name: !!updateData.first_name,
        last_name: !!updateData.last_name,
        email: !!updateData.email,
        user_type: !!updateData.user_type
      });
      return c.json({ 
        success: false,
        error: 'First name, last name, email, and user type are required' 
      }, 400);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true }
    });

    if (!existingUser) {
      console.log('🔴 User not found with ID:', userId);
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    console.log('🔵 Existing User:', {
      id: existingUser.id,
      user_type: existingUser.user_type,
      department: existingUser.department
    });

    // Authorization checks
    if (userType === 'STAFF' && authUserId !== userId) {
      console.log('🔴 STAFF user trying to update another user');
      return c.json({ 
        success: false,
        error: 'You can only update your own profile' 
      }, 403);
    }

    if ((userType === 'HEAD' || userType === 'DepartmentHead') && authUser.departmentId) {
      // HEAD can only update STAFF in their department
      if (existingUser.user_type !== 'STAFF' || existingUser.departmentId !== authUser.departmentId) {
        console.log('🔴 HEAD user unauthorized to update this user');
        return c.json({ 
          success: false,
          error: 'You can only update STAFF users in your department' 
        }, 403);
      }
    }

    // Check for email duplication
    if (updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: updateData.email,
          id: { not: userId }
        }
      });

      if (emailExists) {
        console.log('🔴 Email already exists:', updateData.email);
        return c.json({ 
          success: false,
          error: 'Email already exists' 
        }, 409);
      }
    }

    // Prepare update data
    const dataToUpdate: any = {
      first_name: updateData.first_name,
      last_name: updateData.last_name,
      email: updateData.email,
      user_type: updateData.user_type,
      updated_at: new Date(),
    };

    // Handle department
    if (updateData.departmentId !== undefined) {
      if (updateData.departmentId === '' || updateData.departmentId === null) {
        dataToUpdate.departmentId = null;
      } else {
        const departmentId = parseInt(updateData.departmentId);
        
        if (isNaN(departmentId)) {
          return c.json({ 
            success: false,
            error: 'Invalid department ID' 
          }, 400);
        }

        // Verify department exists
        const department = await prisma.department.findUnique({
          where: { id: departmentId }
        });

        if (!department) {
          console.log('🔴 Department not found:', departmentId);
          return c.json({ 
            success: false,
            error: 'Department not found' 
          }, 404);
        }

        dataToUpdate.departmentId = departmentId;
      }
    }

    // Special handling for HEAD users
    if (updateData.user_type === 'HEAD' && dataToUpdate.departmentId) {
      const existingHead = await prisma.user.findFirst({
        where: {
          user_type: 'HEAD',
          departmentId: dataToUpdate.departmentId,
          id: { not: userId }
        }
      });

      if (existingHead) {
        console.log('🔴 Department already has a HEAD:', dataToUpdate.departmentId);
        return c.json({ 
          success: false,
          error: 'This department already has a HEAD user' 
        }, 409);
      }
    }

    console.log('🔵 Data to update:', dataToUpdate);

    // Perform update
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
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
          select: { 
            id: true,
            name: true 
          },
        },
      },
    });

    console.log('✅ User updated successfully:', updatedUser.id);

    return c.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    }, 200);

  } catch (error) {
    console.error('🔴 Error updating user:', error);
    
    // Handle Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('P2025')) {
        return c.json({ 
          success: false,
          error: 'User not found' 
        }, 404);
      }
      
      if (error.message.includes('P2002')) {
        return c.json({ 
          success: false,
          error: 'Email already exists' 
        }, 409);
      }
    }

    return c.json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};
