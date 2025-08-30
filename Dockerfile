FROM node:alpine
WORKDIR /app
RUN mkdir data/ai/storage
COPY package*.json .
RUN npm install
COPY . .
EXPOSE 8080
CMD ["npm", "run", "mail"]