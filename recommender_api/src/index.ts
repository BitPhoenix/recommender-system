import app from './app.js';
import config from './config.js';
import driver from './neo4j.js';

// Start server only when not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
    console.log(`Neo4j URI: ${config.NEO4J_URI}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing Neo4j connection...');
  await driver.close();
  process.exit(0);
});

export default app;
