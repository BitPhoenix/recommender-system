import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { MulterError } from 'multer';
import searchRoutes from './routes/search.routes.js';
import similarityRoutes from './routes/similarity.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import contentSearchRoutes from './routes/content-search.routes.js';
import driver from './neo4j.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(morgan('combined'));
  app.use(cors());

  // Health endpoints
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy' });
  });

  app.get('/db-health', async (_req: Request, res: Response) => {
    const session = driver.session();
    try {
      await session.run('RETURN 1 as health');
      res.status(200).json({ status: 'healthy', database: 'connected' });
    } catch (error) {
      res.status(500).json({
        message: 'Database health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await session.close();
    }
  });

  // API routes
  app.use('/api/search', searchRoutes);
  app.use('/api/search', contentSearchRoutes);
  app.use('/api/engineers', similarityRoutes);
  app.use('/api/resume', resumeRoutes);

  // Error handling for file uploads
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: {
            code: "FILE_TOO_LARGE",
            message: "File size exceeds the 10 MB limit",
          },
        });
        return;
      }
      res.status(400).json({
        error: {
          code: "FILE_UPLOAD_ERROR",
          message: err.message,
        },
      });
      return;
    }

    if (err.message?.includes("Invalid file type")) {
      res.status(415).json({
        error: {
          code: "INVALID_FILE_TYPE",
          message: err.message,
        },
      });
      return;
    }

    next(err);
  });

  return app;
}

export default createApp();
