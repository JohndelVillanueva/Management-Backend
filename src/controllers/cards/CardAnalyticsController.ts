// src/controllers/cards/CardAnalyticsController.ts
import type { Context } from "hono";
import prisma from "../../utils/db.js";

export const getCardAnalytics = async (c: Context) => {
  try {
    const cards = await prisma.card.findMany({
      where: {
        status: 'active'
      },
      include: {
        departments: {
          include: {
            department: {
              include: {
                users: {
                  where: { 
                    is_active: true,
                    user_type: { in: ['STAFF', 'HEAD'] } // ✅ Include both STAFF and HEAD
                  }
                }
              }
            }
          }
        },
        submissions: {
          where: { status: 'active' },
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                user_type: true
              }
            }
          }
        },
        files: true,
        head: {
          select: {
            first_name: true,
            last_name: true,
            user_type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const analytics = {
      totalCards: cards.length,
      cardsByDepartment: {},
      totalSubmissions: 0,
      totalFiles: 0,
      recentCards: cards.slice(0, 10).map(card => {
        // Calculate total staff count (including heads)
        const totalStaffCount = card.departments.reduce((total, cd) => {
          return total + cd.department.users.length;
        }, 0);

        // Count submissions by user type for debugging
        const staffSubmissions = card.submissions.filter(sub => sub.user.user_type === 'STAFF').length;
        const headSubmissions = card.submissions.filter(sub => sub.user.user_type === 'HEAD').length;
        
        return {
          id: card.id,
          title: card.title,
          description: card.description,
          department: card.departments.map(cd => cd.department.name).join(', '),
          submissions: card.submissions.length,
          submissionsCount: card.submissions.length,
          staffSubmissions: staffSubmissions,
          headSubmissions: headSubmissions,
          totalStaffCount: totalStaffCount, // ✅ Includes both STAFF and HEAD
          files: card.files.length,
          createdAt: card.createdAt,
          expiresAt: card.expiresAt,
          isPublic: card.isPublic,
          status: card.status,
          head: card.head ? {
            first_name: card.head.first_name,
            last_name: card.head.last_name,
            user_type: card.head.user_type
          } : null,
          departments: card.departments.map(cd => ({
            id: cd.department.id,
            name: cd.department.name,
            staffCount: cd.department.users.length, // This now includes heads
            users: cd.department.users.map(user => ({
              id: user.id,
              first_name: user.first_name,
              last_name: user.last_name,
              user_type: user.user_type
            }))
          })),
          // Debug info
          _debug: {
            totalUsers: totalStaffCount,
            staffUsers: card.departments.reduce((total, cd) => 
              total + cd.department.users.filter(u => u.user_type === 'STAFF').length, 0),
            headUsers: card.departments.reduce((total, cd) => 
              total + cd.department.users.filter(u => u.user_type === 'HEAD').length, 0)
          }
        };
      })
    };

    // Calculate cards by department
    cards.forEach(card => {
      card.departments.forEach(cd => {
        const deptName = cd.department.name;
        analytics.cardsByDepartment[deptName] = (analytics.cardsByDepartment[deptName] || 0) + 1;
      });
    });

    // Calculate totals
    analytics.totalSubmissions = cards.reduce((sum, card) => sum + card.submissions.length, 0);
    analytics.totalFiles = cards.reduce((sum, card) => sum + card.files.length, 0);

    return c.json(analytics);
  } catch (error) {
    console.error('Error fetching card analytics:', error);
    return c.json({ error: 'Failed to fetch card analytics' }, 500);
  }
};