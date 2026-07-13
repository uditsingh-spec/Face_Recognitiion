import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;
  
  const fs = require('fs');
  fs.appendFileSync('C:\\Users\\Lenovo\\.vscode\\Med_Data_Erp\\error.log', new Date().toISOString() + ' Error name: ' + err.name + ' | Error message: ' + err.message + ' | URL: ' + req.originalUrl + ' | Body: ' + JSON.stringify(req.body) + ' | Stack: ' + err.stack + '\n');

  if (err instanceof ZodError || err.name === 'ZodError') {
    statusCode = 400;
    const issues = err.issues || [];
    message = issues.map((e: any) => e.message).join(', ');
  } else if (err.name === 'ValidationError') {
    // Handle Mongoose Validation Error
    statusCode = 400;
    message = Object.values(err.errors as Record<string, any>).map(e => e.message).join(', ');
  } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
