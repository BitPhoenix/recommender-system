# Claude Instructions

## Development Environment

The API server runs via Tilt in a Kubernetes cluster (minikube). **Do not start any servers manually** - they are already running when working on this project.

- Run `./bin/tilt-start.sh` to start all services (Neo4j, API, Client)
- API available at: `http://localhost:4025`
- Neo4j available at: `bolt://localhost:7687` and `http://localhost:7474`
- Client available at: `http://localhost:5173`

## API Testing

### Postman Collection
The Postman collection at `postman/collections/search-filter-tests.postman_collection.json` contains comprehensive API tests.

**Important:** Update the Postman collection whenever API changes are made (new endpoints, changed request/response schemas, new filters, etc.).

### Running Tests with Newman
Use Newman to run the Postman collection for API validation:

```bash
npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json
```
