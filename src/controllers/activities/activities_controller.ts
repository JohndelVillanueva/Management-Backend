// controllers/admin_controller.ts
import type { Context } from "hono";
import prisma from "../../utils/db.js";

// 1. Overall Statistics
export const getOverviewStats = async (c: Context) => {
  try {
    const now = new Date();

    // Get total active cards
    const totalCards = await prisma.card.count({
      where: { status: 'active' }
    });

    // Get all active cards with their submissions
    const cards = await prisma.card.findMany({
      where: { status: 'active' },
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
      }
    });

    let completedCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let totalSubmissionTime = 0;
    let submissionTimeCount = 0;

    cards.forEach(card => {
      const expectedSubmissions = card.department.users.length;
      const actualSubmissions = card.submissions.length;
      const isOverdue = card.expiresAt && card.expiresAt < now;

      if (actualSubmissions >= expectedSubmissions) {
        completedCount++;
        // Calculate average submission time for completed cards
        card.submissions.forEach(sub => {
          const timeDiff = sub.createdAt.getTime() - card.createdAt.getTime();
          totalSubmissionTime += timeDiff;
          submissionTimeCount++;
        });
      } else if (isOverdue) {
        overdueCount++;
      } else {
        pendingCount++;
      }
    });

    const completionRate = totalCards > 0 
      ? parseFloat(((completedCount / totalCards) * 100).toFixed(1))
      : 0;

    const avgSubmissionTime = submissionTimeCount > 0
      ? (totalSubmissionTime / submissionTimeCount / (1000 * 60 * 60 * 24)).toFixed(1)
      : '0';

    return c.json({
      totalCards,
      submitted: completedCount,
      pending: pendingCount,
      overdue: overdueCount,
      completionRate,
      avgSubmissionTime: `${avgSubmissionTime} days`
    }, 200);
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    return c.json({ error: 'Failed to fetch statistics' }, 500);
  }
};

// 2. Real-time Metrics
export const getRealtimeMetrics = async (c: Context) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const activeThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

    // Active teachers (logged in within last 15 minutes)
    const activeTeachers = await prisma.user.count({
      where: {
        is_active: true,
        last_login: { gte: activeThreshold }
      }
    });

    // Submissions today
    const submittedToday = await prisma.submission.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd
        },
        status: 'active'
      }
    });

    // Pending submissions (cards with incomplete submissions)
    const activeCards = await prisma.card.findMany({
      where: { 
        status: 'active',
        expiresAt: { gte: now }
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
      }
    });

    let pendingCount = 0;
    activeCards.forEach(card => {
      const expected = card.department.users.length;
      const actual = card.submissions.length;
      pendingCount += Math.max(0, expected - actual);
    });

    // Cards due today
    const tomorrowStart = new Date(todayEnd.getTime() + 1);
    const dueToday = await prisma.card.count({
      where: {
        status: 'active',
        expiresAt: {
          gte: todayStart,
          lt: tomorrowStart
        }
      }
    });

    return c.json({
      activeTeachers,
      submittedToday,
      pendingNow: pendingCount,
      dueToday
    }, 200);
  } catch (error) {
    console.error('Error fetching realtime metrics:', error);
    return c.json({ error: 'Failed to fetch metrics' }, 500);
  }
};

// 3. All Cards with Submission Progress
export const getAllCardsWithProgress = async (c: Context) => {
  try {
    const now = new Date();

    const cards = await prisma.card.findMany({
      where: { status: 'active' },
      include: {
        head: {
          select: {
            first_name: true,
            last_name: true,
            user_type: true
          }
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
        submissions: {
          where: { status: 'active' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const cardsWithProgress = cards.map(card => {
      const totalStaff = card.department.users.length;
      const submissions = card.submissions.length;
      const isOverdue = card.expiresAt && card.expiresAt < now;
      const isCompleted = submissions >= totalStaff;

      let status = 'Pending';
      let priority = 'Medium';

      if (isCompleted) {
        status = 'Completed';
      } else if (isOverdue) {
        status = 'Overdue';
        priority = 'Urgent';
      } else if (submissions > 0) {
        status = 'In Progress';
      }

      // Determine priority based on deadline
      if (card.expiresAt && !isCompleted) {
        const daysUntilDue = Math.ceil((card.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 1) {
          priority = 'Urgent';
        } else if (daysUntilDue <= 3) {
          priority = 'High';
        }
      }

      const postedBy = card.head 
        ? `${card.head.first_name} ${card.head.last_name}` 
        : card.head?.user_type === 'ADMIN' ? 'Admin Office' : 'Department Head';

      return {
        id: card.id,
        title: card.title,
        postedBy,
        deadline: card.expiresAt?.toISOString().split('T')[0] || 'No deadline',
        status,
        priority,
        department: card.department.name,
        submissions,
        totalStaff,
        completedOn: isCompleted ? card.updatedAt.toISOString().split('T')[0] : null
      };
    });

    return c.json(cardsWithProgress, 200);
  } catch (error) {
    console.error('Error fetching cards:', error);
    return c.json({ error: 'Failed to fetch cards' }, 500);
  }
};

// 4. Department Statistics
export const getDepartmentStats = async (c: Context) => {
  try {
    const now = new Date();

    const departments = await prisma.department.findMany({
      include: {
        cards: {
          where: { status: 'active' },
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
          }
        }
      }
    });

    const departmentStats = departments.map(dept => {
      let completedCards = 0;
      const totalCards = dept.cards.length;

      dept.cards.forEach(card => {
        const expectedSubmissions = card.department.users.length;
        const actualSubmissions = card.submissions.length;
        
        if (actualSubmissions >= expectedSubmissions) {
          completedCards++;
        }
      });

      const rate = totalCards > 0 
        ? Math.round((completedCards / totalCards) * 100)
        : 0;

      return {
        department: dept.name,
        rate,
        submitted: completedCards,
        total: totalCards
      };
    });

    return c.json(departmentStats, 200);
  } catch (error) {
    console.error('Error fetching department stats:', error);
    return c.json({ error: 'Failed to fetch department statistics' }, 500);
  }
};

// 5. Recent Activity (limit parameter)
export const getRecentActivity = async (c: Context) => {
  try {
    const limit = parseInt(c.req.query('limit') || '8');

    const activities = await prisma.activity.findMany({
      where: {
        action: 'upload' // Focus on submissions/uploads
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true
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
      
      return {
        id: activity.id,
        teacher: `${activity.user.first_name} ${activity.user.last_name}`,
        card: activity.description || 'Document',
        action: 'Submitted',
        time: timeAgo
      };
    });

    return c.json(recentActivity, 200);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return c.json({ error: 'Failed to fetch activities' }, 500);
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