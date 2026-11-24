import type { Request, Response } from "express";

/** Cualquier ruta que no coincidió con ninguna otra: 404 en JSON. */
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not Found" });
}
