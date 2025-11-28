// controllers/activities_controller.ts
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

    // Get all active cards with their submissions and departments
    const cards = await prisma.card.findMany({
      where: { status: 'active' },
      include: {
        submissions: {
          where: { status: 'active' }
        },
        departments: {
          include: {
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

    let completedCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let totalSubmissionTime = 0;
    let submissionTimeCount = 0;

    cards.forEach(card => {
      // Calculate total staff across all departments for this card
      const totalStaff = card.departments.reduce((sum, cd) => {
        return sum + cd.department.users.length;
      }, 0);
      
      const actualSubmissions = card.submissions.length;
      const isOverdue = card.expiresAt && card.expiresAt < now;

      if (actualSubmissions >= totalStaff && totalStaff > 0) {
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
    // Get total active staff and heads
    const totalStaff = await prisma.user.count({
      where: {
        user_type: { in: ['STAFF', 'HEAD'] },
        is_active: true
      }
    });

    // Get submissions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const submittedToday = await prisma.submission.count({
      where: {
        createdAt: {
          gte: today
        }
      }
    });

    // Get pending cards (cards with submissions less than total staff)
    const allCards = await prisma.card.findMany({
      where: {
        status: 'active',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        departments: {
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
            }
          }
        },
        submissions: true
      }
    });

    const pendingNow = allCards.filter(card => {
      // Calculate total staff across all departments for this card
      const totalStaffInDept = card.departments.reduce((sum, cd) => {
        return sum + cd.department.users.length;
      }, 0);
      return card.submissions.length < totalStaffInDept;
    }).length;

    const dueToday = allCards.filter(card => 
      card.expiresAt && 
      new Date(card.expiresAt).toDateString() === new Date().toDateString()
    ).length;

    return c.json({
      activeTeachers: totalStaff,
      submittedToday,
      pendingNow,
      dueToday
    });
  } catch (error) {
    console.error('Error fetching realtime metrics:', error);
    return c.json({ error: 'Failed to fetch realtime metrics' }, 500);
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
        departments: {
          include: {
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
      // Calculate total staff across all departments for this card
      const totalStaff = card.departments.reduce((sum, cd) => {
        return sum + cd.department.users.length;
      }, 0);
      
      const submissions = card.submissions.length;
      const isOverdue = card.expiresAt && card.expiresAt < now;
      const isCompleted = submissions >= totalStaff && totalStaff > 0;

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

      // Get department names (for multi-department support)
      const departmentNames = card.departments.map(cd => cd.department.name).join(', ');

      return {
        id: card.id,
        title: card.title,
        postedBy,
        deadline: card.expiresAt?.toISOString().split('T')[0] || 'No deadline',
        status,
        priority,
        department: departmentNames || 'No Department',
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

// 4. Department Statistics - KEEP ONLY ONE VERSION OF THIS FUNCTION
export const getDepartmentStats = async (c: Context) => {
  try {
    const now = new Date();

    const departments = await prisma.department.findMany({
      include: {
        cardDepartments: {
          include: {
            card: {
              where: { status: 'active' },
              include: {
                submissions: {
                  where: { status: 'active' }
                }
              }
            }
          }
        },
        users: {
          where: { 
            is_active: true,
            user_type: 'STAFF'
          }
        }
      }
    });

    const departmentStats = departments.map(dept => {
      let completedCards = 0;
      const totalCards = dept.cardDepartments.length;

      dept.cardDepartments.forEach(cd => {
        const card = cd.card;
        if (!card) return;
        
        const expectedSubmissions = dept.users.length;
        const actualSubmissions = card.submissions.length;
        
        if (actualSubmissions >= expectedSubmissions && expectedSubmissions > 0) {
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

// 6. Department Storage Data
export const getDepartmentStorage = async (c: Context) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        users: {
          where: { 
            is_active: true,
            user_type: { in: ['STAFF', 'HEAD'] }
          }
        },
        cardDepartments: {
          include: {
            card: {
              where: { status: 'active' },
              include: {
                submissions: {
                  where: { status: 'active' },
                  include: {
                    files: true
                  }
                },
                files: true
              }
            }
          }
        }
      }
    });

    const departmentStorage = departments.map(dept => {
      // Calculate storage metrics
      let totalSubmissions = 0;
      let completedCards = 0;
      let pendingCards = 0;
      let totalFileSize = 0;
      let totalFiles = 0;

      dept.cardDepartments.forEach(cd => {
        const card = cd.card;
        if (!card) return;

        const expectedSubmissions = dept.users.length;
        const actualSubmissions = card.submissions.length;
        
        // Count card status
        if (actualSubmissions >= expectedSubmissions) {
          completedCards++;
        } else {
          pendingCards++;
        }

        totalSubmissions += actualSubmissions;

        // Calculate file storage for card submissions
        card.submissions.forEach(submission => {
          submission.files.forEach(file => {
            totalFileSize += file.size || 0;
            totalFiles++;
          });
        });

        // Calculate file storage for card itself
        card.files.forEach(file => {
          totalFileSize += file.size || 0;
          totalFiles++;
        });
      });

      // Calculate completion rate
      const totalCards = dept.cardDepartments.length;
      const completionRate = totalCards > 0 
        ? Math.round((completedCards / totalCards) * 100)
        : 0;

      // Calculate storage usage percentage
      const STORAGE_LIMITS = {
        MAX_STORAGE: 2 * 1024 * 1024 * 1024, // 2GB max storage per department
      };
      const storageUsage = totalFileSize / STORAGE_LIMITS.MAX_STORAGE;
      const storagePercentage = Math.round(storageUsage * 100);

      // Determine storage status
      let storageStatus = 'normal';
      if (storageUsage >= 0.9) { // 90% - critical
        storageStatus = 'critical';
      } else if (storageUsage >= 0.8) { // 80% - warning
        storageStatus = 'warning';
      }

      // Format file size for display
      const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return {
        department: dept.name,
        staffCount: dept.users.length,
        totalCards,
        totalSubmissions,
        completedCards,
        pendingCards,
        completionRate,
        totalFiles,
        totalStorage: formatFileSize(totalFileSize),
        rawStorage: totalFileSize,
        storagePercentage,
        storageStatus,
        maxStorage: STORAGE_LIMITS.MAX_STORAGE,
        maxStorageFormatted: formatFileSize(STORAGE_LIMITS.MAX_STORAGE)
      };
    });

    return c.json(departmentStorage, 200);
  } catch (error) {
    console.error('Error fetching department storage:', error);
    return c.json({ error: 'Failed to fetch department storage data' }, 500);
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