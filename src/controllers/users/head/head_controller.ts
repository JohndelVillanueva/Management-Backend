// controllers/head_controller.ts
import type { Context } from "hono";
import prisma from "../../../utils/db.js";

// 1. Department Statistics for HEAD
export const getDepartmentStats = async (c: Context) => {
  try {
    // Get departmentId from authenticated user
    const departmentId = c.req.query('departmentId');
    
    if (!departmentId) {
      return c.json({ error: 'Department ID is required' }, 400);
    }

    const deptId = parseInt(departmentId);
    const now = new Date();

    // Get total staff in department
    const totalStaff = await prisma.user.count({
      where: {
        departmentId: deptId,
        user_type: 'STAFF',
        is_active: true
      }
    });

    // Get active staff (logged in within last 30 minutes)
    const activeThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const activeStaff = await prisma.user.count({
      where: {
        departmentId: deptId,
        user_type: 'STAFF',
        is_active: true,
        last_login: { gte: activeThreshold }
      }
    });

    // Get all cards for this department
    const cards = await prisma.card.findMany({
      where: {
        departmentId: deptId,
        status: 'active'
      },
      include: {
        submissions: {
          where: { status: 'active' }
        }
      }
    });

    const totalCards = cards.length;
    let activeCards = 0;
    let completedSubmissions = 0;
    let pendingSubmissions = 0;
    let overdueCount = 0;

    cards.forEach(card => {
      const isOverdue = card.expiresAt && card.expiresAt < now;
      const isComplete = card.submissions.length >= totalStaff;

      if (!isComplete && !isOverdue) {
        activeCards++;
      }

      if (isComplete) {
        completedSubmissions += card.submissions.length;
      } else {
        pendingSubmissions += (totalStaff - card.submissions.length);
      }

      if (isOverdue && !isComplete) {
        overdueCount++;
      }
    });

    // Calculate performance (completion rate)
    const performance = totalCards > 0 
      ? Math.round((cards.filter(c => c.submissions.length >= totalStaff).length / totalCards) * 100)
      : 0;

    console.log(`📊 Department ${deptId} Stats:`, {
      totalStaff,
      activeStaff,
      totalCards,
      activeCards,
      completedSubmissions,
      pendingSubmissions,
      overdueCount,
      performance
    });

    return c.json({
      totalStaff,
      activeStaff,
      totalCards,
      activeCards,
      completedSubmissions,
      pendingSubmissions,
      overdueCount,
      performance
    }, 200);
  } catch (error) {
    console.error('Error fetching department stats:', error);
    return c.json({ error: 'Failed to fetch department statistics' }, 500);
  }
};

// 2. Recent Activity for Department
export const getDepartmentActivity = async (c: Context) => {
  try {
    const departmentId = c.req.query('departmentId');
    const limit = parseInt(c.req.query('limit') || '10');

    if (!departmentId) {
      return c.json({ error: 'Department ID is required' }, 400);
    }

    const deptId = parseInt(departmentId);

    // Get activities from users in this department
    const activities = await prisma.activity.findMany({
      where: {
        user: {
          departmentId: deptId
        }
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            user_type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const recentActivity = activities.map(activity => {
      const timeAgo = getTimeAgo(activity.createdAt);
      
      // Determine activity type based on action
      let type = 'submission';
      if (activity.resourceType === 'card') type = 'card';
      if (activity.action === 'create' && activity.resourceType === 'user') type = 'staff';

      // Determine status
      let status = 'active';
      if (activity.action === 'upload' || activity.action === 'create') status = 'completed';
      if (activity.action === 'view') status = 'pending';

      return {
        id: activity.id,
        type,
        title: activity.description || `${activity.action} ${activity.resourceType}`,
        user: `${activity.user.first_name} ${activity.user.last_name}`,
        time: timeAgo,
        status
      };
    });

    console.log(`📊 Department ${deptId} Recent Activity: ${recentActivity.length} items`);

    return c.json(recentActivity, 200);
  } catch (error) {
    console.error('Error fetching department activity:', error);
    return c.json({ error: 'Failed to fetch department activity' }, 500);
  }
};

// 3. Upcoming Deadlines for Department
export const getDepartmentDeadlines = async (c: Context) => {
  try {
    const departmentId = c.req.query('departmentId');
    const limit = parseInt(c.req.query('limit') || '5');

    if (!departmentId) {
      return c.json({ error: 'Department ID is required' }, 400);
    }

    const deptId = parseInt(departmentId);
    const now = new Date();

    // Get cards with upcoming deadlines
    const cards = await prisma.card.findMany({
      where: {
        departmentId: deptId,
        status: 'active',
        expiresAt: {
          gte: now // Only future deadlines
        }
      },
      include: {
        submissions: {
          where: { status: 'active' }
        },
        department: {
          include: {
            users: {
              where: { 
                is_active: true,
                user_type: 'STAFF'
              }
            }
          }
        }
      },
      orderBy: {
        expiresAt: 'asc'
      },
      take: limit
    });

    const upcomingDeadlines = cards.map(card => {
      const totalStaff = card.department.users.length;
      const submissions = card.submissions.length;
      const isComplete = submissions >= totalStaff;

      // Calculate days until due
      const daysUntilDue = Math.ceil((card.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Determine priority
      let priority = 'low';
      if (daysUntilDue <= 1) {
        priority = 'high';
      } else if (daysUntilDue <= 3) {
        priority = 'medium';
      }

      return {
        id: card.id,
        title: card.title,
        deadline: card.expiresAt!.toISOString().split('T')[0],
        priority,
        assignedTo: `${submissions}/${totalStaff} staff submitted`,
        isComplete
      };
    });

    console.log(`📊 Department ${deptId} Upcoming Deadlines: ${upcomingDeadlines.length} items`);

    return c.json(upcomingDeadlines, 200);
  } catch (error) {
    console.error('Error fetching department deadlines:', error);
    return c.json({ error: 'Failed to fetch department deadlines' }, 500);
  }
};

// 4. Department Cards Overview
export const getDepartmentCards = async (c: Context) => {
  try {
    const departmentId = c.req.query('departmentId');

    if (!departmentId) {
      return c.json({ error: 'Department ID is required' }, 400);
    }

    const deptId = parseInt(departmentId);
    const now = new Date();

    const cards = await prisma.card.findMany({
      where: {
        departmentId: deptId,
        status: 'active'
      },
      include: {
        submissions: {
          where: { status: 'active' }
        },
        department: {
          include: {
            users: {
              where: { 
                is_active: true,
                user_type: 'STAFF'
              }
            }
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

    const cardsData = cards.map(card => {
      const totalStaff = card.department.users.length;
      const submissions = card.submissions.length;
      const isOverdue = card.expiresAt && card.expiresAt < now;
      const isComplete = submissions >= totalStaff;

      let status = 'pending';
      if (isComplete) status = 'completed';
      else if (isOverdue) status = 'overdue';
      else if (submissions > 0) status = 'in-progress';

      return {
        id: card.id,
        title: card.title,
        description: card.description,
        deadline: card.expiresAt?.toISOString().split('T')[0] || 'No deadline',
        submissions,
        totalStaff,
        status,
        createdBy: card.head ? `${card.head.first_name} ${card.head.last_name}` : 'Admin',
        createdAt: card.createdAt.toISOString().split('T')[0]
      };
    });

    console.log(`📊 Department ${deptId} Cards: ${cardsData.length} items`);

    return c.json(cardsData, 200);
  } catch (error) {
    console.error('Error fetching department cards:', error);
    return c.json({ error: 'Failed to fetch department cards' }, 500);
  }
};

// 5. Department Staff List
export const getDepartmentStaff = async (c: Context) => {
  try {
    const departmentId = c.req.query('departmentId');

    if (!departmentId) {
      return c.json({ error: 'Department ID is required' }, 400);
    }

    const deptId = parseInt(departmentId);
    const activeThreshold = new Date(Date.now() - 30 * 60 * 1000);

    const staff = await prisma.user.findMany({
      where: {
        departmentId: deptId,
        user_type: { in: ['STAFF', 'HEAD'] },
        is_active: true
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        user_type: true,
        last_login: true,
        created_at: true,
        submissions: {
          where: { status: 'active' },
          select: { id: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const staffData = staff.map(member => ({
      id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      email: member.email,
      role: member.user_type,
      isOnline: member.last_login && member.last_login >= activeThreshold,
      lastLogin: member.last_login?.toISOString() || null,
      totalSubmissions: member.submissions.length,
      joinedAt: member.created_at.toISOString().split('T')[0]
    }));

    console.log(`📊 Department ${deptId} Staff: ${staffData.length} members`);

    return c.json(staffData, 200);
  } catch (error) {
    console.error('Error fetching department staff:', error);
    return c.json({ error: 'Failed to fetch department staff' }, 500);
  }
};

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}