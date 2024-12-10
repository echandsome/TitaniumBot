# Prerequisites
- All project dependencies are handled by docker so before starting the project install the docker
in your system. Reference: https://docs.docker.com/engine/install/
- Navigate to the file /app/utils/pool_filter_params.js to access the configurations variables for the bot. Feel free to make updates directly in this file.

1. Run the following command in the project directory
```
npm install
```
2. Build & start the docker containers with command
```
docker compose up -d --build
```
3. To run Backend
```
npm run start-dev
```


# Available commands

- UP docker-compose for dev to start containers in development mode

```
docker compose up -d
```

---

- buid docker-compose for dev to build and start containers in development mode

```
docker compose up -d --build
```

---

- Stop containers which are running in development mode

```
docker compose down
```

---

- Show logs for the backend-app docker container

```
docker compose logs solana-bot-backend-app -f
```

- You can run commands inside the backend-app docker container via:

```
docker exec -it solana-bot-backend-app bash
```

- You can run commands inside the mongo docker container via:

```
docker exec -it solana-bot-mongo-db bash

```
