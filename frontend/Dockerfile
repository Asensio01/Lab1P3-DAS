FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* /app/
RUN pnpm install

COPY . /app

EXPOSE 5173

CMD ["pnpm", "dev"]
