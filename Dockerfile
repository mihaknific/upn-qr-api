# Uporabimo lahek Node.js LTS image (Alpine Linux za hitrost in majhno velikost)
FROM node:20-alpine

# Ustvarimo in nastavimo delovno mapo
WORKDIR /usr/src/app

# Kopiramo package.json in package-lock.json za cache-iranje NPM inštalacij
COPY package*.json ./

# Namestimo odvisnosti (le production)
RUN npm ci --only=production

# Kopiramo celotno kodo
COPY . .

# Odpremo port, ki ga strežnik posluša
EXPOSE 3000

# Zaženemo strežnik
CMD ["npm", "start"]
