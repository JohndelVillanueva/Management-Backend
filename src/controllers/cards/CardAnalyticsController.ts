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
                    user_type: 'STAFF'
                  }
                }
              }
            }
          }
        },
        submissions: {
          where: { status: 'active' }
        },
        files: true,
        head: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      }
    });

    const analytics = {
      totalCards: cards.length,
      cardsByDepartment: {},
      totalSubmissions: 0,
      totalFiles: 0,
      recentCards: cards.slice(0, 5).map(card => ({
        id: card.id,
        title: card.title,
        department: card.departments.map(cd => cd.department.name).join(', '),
        submissions: card.submissions.length,
        files: card.files.length,
        createdAt: card.createdAt
      }))
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