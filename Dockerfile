FROM node:16.18.0 as node-image



WORKDIR /server

COPY package.json /server/
COPY package-lock.json /server/

ARG NODE_ENV

RUN npm install

COPY . ./

CMD ["npm", "run", "start-dev"]