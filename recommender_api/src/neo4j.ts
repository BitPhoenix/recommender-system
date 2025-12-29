import neo4j, { Driver } from "neo4j-driver";
import config from "./config.js";

const driver: Driver = neo4j.driver(
  config.NEO4J_URI,
  neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD)
);

export default driver;
