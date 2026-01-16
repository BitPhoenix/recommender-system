interface Config {
  PORT: number;
  NODE_ENV: string;
  NEO4J_URI: string;
  NEO4J_USER: string;
  NEO4J_PASSWORD: string;
  LLM_HOST: string;
  LLM_MODEL: string;
  LLM_ENABLED: boolean;
  LLM_TIMEOUT_MS: number;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || "4025", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  NEO4J_URI: process.env.NEO4J_URI || "bolt://localhost:7687",
  NEO4J_USER: process.env.NEO4J_USER || "neo4j",
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || "password",
  LLM_HOST: process.env.LLM_HOST || "http://127.0.0.1:11434",
  LLM_MODEL: process.env.LLM_MODEL || "qwen2.5:14b-instruct",
  LLM_ENABLED: process.env.LLM_ENABLED !== "false",
  LLM_TIMEOUT_MS: parseInt(process.env.LLM_TIMEOUT_MS || "5000", 10),
};

export default config;
