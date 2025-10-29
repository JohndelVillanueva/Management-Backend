// src/controllers/activities/ActivityStatsController.ts
import type { Context } from "hono";
import prisma from "../../utils/db.js";

export const getActivityOverview = async (c: Context) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activities = await prisma.activity.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            department: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const overview = {
      totalActivities: activities.length,
      activitiesByType: activities.reduce((acc, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentActivities: activities.slice(0, 10).map(activity => ({
        id: activity.id,
        user: `${activity.user.first_name} ${activity.user.last_name}`,
        action: activity.action,
        description: activity.description,
        department: activity.user.department?.name || 'No Department',
        time: activity.createdAt
      }))
    };

    return c.json(overview);
  } catch (error) {
    console.error('Error fetching activity overview:', error);
    return c.json({ error: 'Failed to fetch activity overview' }, 500);
  }
};

export const getRealtimeStats = async (c: Context) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayActivities = await prisma.activity.count({
      where: {
        createdAt: {
          gte: today
        }
      }
    });

    const totalUsers = await prisma.user.count({
      where: {
        is_active: true,
        user_type: { in: ['STAFF', 'HEAD'] } // Only count staff and heads as "active teachers"
      }
    });

    const totalCards = await prisma.card.count({
      where: {
        status: 'active'
      }
    });

    const totalSubmissions = await prisma.submission.count({
      where: {
        status: 'active'
      }
    });

    return c.json({
      todayActivities,
      activeTeachers: totalUsers, // Changed to match frontend expectation
      totalCards,
      totalSubmissions
    });
  } catch (error) {
    console.error('Error fetching realtime stats:', error);
    return c.json({ error: 'Failed to fetch realtime stats' }, 500);
  }
};

export const getDepartmentActivityStats = async (c: Context) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const departments = await prisma.department.findMany({
      include: {
        users: {
          include: {
            activities: {
              where: {
                createdAt: {
                  gte: thirtyDaysAgo
                }
              }
            }
          }
        },
        cardDepartments: {
          include: {
            card: {
              include: {
                _count: {
                  select: {
                    submissions: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const stats = departments.map(dept => {
      const userActivities = dept.users.reduce((total, user) => total + user.activities.length, 0);
      const cardSubmissions = dept.cardDepartments.reduce((total, cd) => total + (cd.card?._count.submissions || 0), 0);

      return {
        id: dept.id,
        name: dept.name,
        userCount: dept.users.length,
        cardCount: dept.cardDepartments.length,
        totalActivities: userActivities,
        totalSubmissions: cardSubmissions
      };
    });

    return c.json(stats);
  } catch (error) {
    console.error('Error fetching department activity stats:', error);
    return c.json({ error: 'Failed to fetch department activity stats' }, 500);
  }
};

export const getRecentActivity = async (c: Context) => {
  try {
    const limit = parseInt(c.req.query('limit') || '8');

    // Get real submission activities with proper relationships
    const submissions = await prisma.submission.findMany({
      where: {
        status: 'active'
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            user_type: true,
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        card: {
          select: {
            id: true,
            title: true,
            departments: {
              include: {
                department: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Transform the data - NO STATIC VALUES
    const recentActivity = submissions.map(submission => {
      const timeAgo = getTimeAgo(submission.createdAt);
      
      // Use actual card title or fallback to card ID
      const cardTitle = submission.card?.title || `Card #${submission.card?.id || 'Unknown'}`;
      
      // Use actual user name or fallback to user type
      const userName = submission.user ? 
        `${submission.user.first_name || ''} ${submission.user.last_name || ''}`.trim() : 
        `User #${submission.userId}`;
      
      // Use actual department or fallback to card's first department
      let departmentName = submission.user?.department?.name;
      if (!departmentName && submission.card?.departments?.length > 0) {
        departmentName = submission.card.departments[0].department.name;
      }
      if (!departmentName) {
        departmentName = 'No Department Assigned';
      }

      return {
        id: submission.id,
        userId: submission.userId,
        cardId: submission.cardId,
        teacher: userName,
        card: cardTitle,
        action: 'Submitted', // This is always "Submitted" for submissions
        time: timeAgo,
        department: departmentName,
        userType: submission.user?.user_type || 'Unknown',
        createdAt: submission.createdAt
      };
    });

    // If no submissions found, return empty array instead of falling back to activities
    if (recentActivity.length === 0) {
      console.log('No recent submissions found');
      return c.json([]);
    }

    console.log(`Found ${recentActivity.length} recent activities`);
    return c.json(recentActivity, 200);

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return c.json({ error: 'Failed to fetch activities' }, 500);
  }
};

// Helper function
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