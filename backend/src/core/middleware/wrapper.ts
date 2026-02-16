// src/core/middleware/wrappers.ts
import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/Ujamaadao.types.js";
import { contextMiddleware } from "./context.middleware.js";

export const applyContext = () => 
  (req: Request, res: Response, next: NextFunction) => 
    contextMiddleware(req as AuthRequest, res, next);