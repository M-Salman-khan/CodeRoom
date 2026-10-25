import type { NextFunction, Request, RequestHandler, Response } from "express";

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/** Express 4 does not forward rejected promises; wrap every async route. */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
