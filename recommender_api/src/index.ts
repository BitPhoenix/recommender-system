import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import config from "./config.js";
import driver from "./neo4j.js";
import searchRoutes from "./routes/search.routes.js";

const app = express();

// Middleware
app.use(express.json());
app.use(morgan("combined"));
app.use(cors());

// Health check - liveness
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

// Database health check
app.get("/db-health", async (_req: Request, res: Response) => {
  const session = driver.session();
  try {
    await session.run("RETURN 1 as health");
    res.status(200).json({ message: "Neo4j connection successful" });
  } catch (error) {
    console.error("Neo4j connection error:", error);
    res.status(500).json({
      message: "Neo4j connection failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    await session.close();
  }
});

// API Routes
app.use("/api/search", searchRoutes);

// Start server
app.listen(config.PORT, () => {
  console.log(`Recommender API is running on port ${config.PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing Neo4j driver...");
  await driver.close();
  process.exit(0);
});
