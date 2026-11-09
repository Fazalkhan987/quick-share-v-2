FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm --prefix server install --omit=dev \
 && npm --prefix client install --include=dev \
 && npm run build \
 && rm -rf client/node_modules
ENV NODE_ENV=production
CMD ["npm", "start"]