import { Router, type RequestHandler } from "express";
import { getMe } from "../controllers/me.controller.js";

export function createMeRouter(requireAuth: RequestHandler): Router {
  const router = Router();

  router.get(
    "/",
    requireAuth,
    (_req, res, next) => {
      res.set("Cache-Control", "no-store"); // datos personales: que nadie los guarde
      next();
    },
    getMe,
  );

  return router;
}
