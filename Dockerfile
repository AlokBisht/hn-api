FROM node:12

EXPOSE 3000

CMD ["npm", "start"]

COPY package*.json ./

RUN npm ci

COPY . .

