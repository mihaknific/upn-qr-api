# Uporabimo podprto Node.js LTS različico.
FROM node:24-alpine

# Okolje za produkcijo
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Ustvarimo in nastavimo delovno mapo
WORKDIR /usr/src/app

# Kopiramo package.json in package-lock.json za cache-iranje NPM inštalacij
COPY package*.json ./

# Namestimo le produkcijske odvisnosti
RUN npm ci --omit=dev

# Kopiramo izvorno kodo
COPY . .

# Odpremo vrata strežnika
EXPOSE 3000

# Preverjanje zdravja vsebnika (Docker Healthcheck)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Zaženemo strežnik
CMD ["npm", "start"]
