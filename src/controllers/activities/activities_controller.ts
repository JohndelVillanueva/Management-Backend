// controllers/activities_controller.ts
import type { Context } from "hono";
import prisma from "../../utils/db.js";

export const getAllActivities = async (c: Context) => {
  try {
    const activities = await prisma.activity.findMany({
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return c.json(activities, 200);
  } catch (error) {
    console.error("Error fetching activities:", error);
    return c.json({ error: "Failed to fetch activities" }, 500);
  }
};
