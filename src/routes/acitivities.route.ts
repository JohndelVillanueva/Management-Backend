import { Hono } from "hono";
import { getAllActivities } from "../controllers/activities/activities_controller.js";
import { authMiddleware } from "../middlewares/authmiddleware.js";

export const activitiesRoute = new Hono();

activitiesRoute.get("/", authMiddleware, getAllActivities);