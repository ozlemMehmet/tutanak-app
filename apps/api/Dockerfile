# Yerel gelistirme ve uretim icin tek asamali basit imaj (iskelet — T-001).
FROM node:22-alpine

WORKDIR /app

# Workspace manifestleri once kopyalanir: bagimlilik katmani onbelleklenir.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev", "--workspace", "@tutanak/api"]
