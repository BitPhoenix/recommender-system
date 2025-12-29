interface Config {
  PORT: number;
  NODE_ENV: string;
  NEO4J_URI: string;
  NEO4J_USER: string;
  NEO4J_PASSWORD: string;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || "4025", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  NEO4J_URI: process.env.NEO4J_URI || "bolt://localhost:7687",
  NEO4J_USER: process.env.NEO4J_USER || "neo4j",
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || "password",
};

export default config;
