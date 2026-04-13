# Build BASE
FROM node:22.12.0-alpine as base
WORKDIR /app
RUN apk add build-base g++ cairo-dev pango-dev giflib-dev py-setuptools
RUN npm install -g pnpm@8.15.4
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Build BUILD
FROM base as build
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY . .
ARG ENVIRONMENT
ARG BUILD_ID
ENV BUILD_STANDALONE true
RUN printf "\nNEXT_PUBLIC_ENVIRONMENT=$ENVIRONMENT" >> .env.$ENVIRONMENT
RUN printf "\nNEXT_PUBLIC_BUILD_ID=$BUILD_ID" >> .env.$ENVIRONMENT
RUN pnpm run build:$ENVIRONMENT

# Build PRODUCTION
FROM node:22.12.0-alpine as production
COPY --from=build /app/package.json ./
COPY --from=build /app/next.config.js ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/.next/server ./.next/server

EXPOSE 3000

CMD ["node", "server.js"]
