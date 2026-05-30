FROM node:20-alpine

WORKDIR /app

RUN corepack enable \
	&& corepack prepare pnpm@10.5.2 --activate

COPY package.json pnpm-lock.yaml* /app/
RUN pnpm install

COPY . /app

EXPOSE 5173

CMD ["pnpm", "dev"]
