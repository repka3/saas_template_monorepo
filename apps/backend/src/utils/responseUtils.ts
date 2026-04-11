import type { Request } from "express";
import type { ApiErrorResponse } from "@repo/contracts";
import { logger } from "../lib/logger.js";


export const FRONTEND_BAD_REQUEST = 400; //to use when validating a request
export const FRONTEND_BAD_CREDENTIALS = 401; //to use when credentials are invalid
export const FRONTEND_FORBIDDEN = 403; //to use when user is not authorized to access a resource (we know who the user is but he is not authorized)
export const FRONTEND_NOT_FOUND = 404;
export const FRONTEND_CONFLICT = 409;
export const FRONTEND_TOO_MANY_REQUESTS = 429;
export const BACKEND_ERROR = 500;
export const USER_NEED_TO_CHANGE_PASSWORD = 428;

export const getFailResponseJson = (
  req: Request,
  code: string,
  message: string,
  extra_info?: unknown
): ApiErrorResponse => {
  const response: ApiErrorResponse = {
    code,
    message,
    requestId: req.requestId,
  };

  if (extra_info !== undefined) {
    response.extra_info = extra_info;
  }

  logger.error({ requestId: req.requestId, response }, "Sending API error response");

  return response;
};
