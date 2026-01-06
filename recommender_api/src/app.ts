import express, { Request, Response } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import searchRoutes from './routes/search.routes.js';
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

  return app;
}

export default createApp();
