# Cok asamali imaj. `deps` bagimlilik katmanini onbellekler; `dev` T-001'den beri
# docker-compose.yml'nin (bind-mount + watch) kullandigi hedeftir; `build`+`runtime`
# devops-agent tarafindan release-prep'te eklendi (architecture.md §5.1: tek VPS,
# `docker compose`, api container `restart: unless-stopped`).

# ---- deps: workspace bagimliliklari (root npm ci tum workspace'leri hoist eder) ----
FROM node:22-alpine AS deps
WORKDIR /app

# Workspace manifestleri once kopyalanir: bagimlilik katmani onbelleklenir.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Prisma semasi bagimlilik kurulumundan ONCE kopyalanir: `prisma generate` semaya ihtiyac
# duyar (T-002 — artik postinstall olarak degil, asagida ACIKCA calistirilir, T-027).
COPY apps/api/prisma/ apps/api/prisma/

# T-027 (SonarCloud, PR #27): bagimliliklarin lifecycle script'leri
# (`preinstall`/`install`/`postinstall`/`prepare`) `--ignore-scripts` ile KAPATILIR — aksi
# halde ele gecirilmis herhangi bir bagimlilik imaj derlemesi sirasinda kod calistirabilir.
# Kapatmanin bedeli, gercekten ihtiyac duyulan adimlarin ACIKCA ve denetlenebilir bicimde
# geri getirilmesidir (kok `prepare: husky` bilincli olarak geri GETIRILMEZ: git kancasi
# uretim imajinda gereksizdir):
#   1) `npm rebuild bcrypt sharp` — iki NATIVE modulun platforma uygun ikilisini kurar.
#      Bugun ikisi de ikilisini onceden derlenmis olarak getiriyor (`bcrypt@6` paket ici
#      `prebuilds/`, `sharp@0.35` `@img/sharp-*` optionalDependencies'i), bu yuzden adim
#      saniyeler surer ve cogu platformda etkisizdir; eslesen ikili bulunmayan bir
#      platformda ise kaynaktan derlemeyi dener ve GURULTULU patlar — hata derleme aninda
#      gorunur, uretimde acilmayan bir container olarak degil.
#   2) `node -e "require(...)"` — modullerin FIILEN yuklenebildigini derleme aninda kanitlar
#      (asil kalkan budur; `npm rebuild` sessizce hicbir sey yapmadan da basarili olabilir).
#   3) `prisma generate` — `apps/api` postinstall'inin isiydi. Uretilmis Prisma Client
#      olmadan imaj sorunsuz derlenir ama uygulama ACILMAZ
#      (`Cannot find module '.prisma/client/default'`).
RUN npm ci --ignore-scripts \
    && npm rebuild bcrypt sharp \
    && node -e "require('bcrypt'); require('sharp')" \
    && npm run prisma:generate --workspace @tutanak/api

# ---- dev: yerel gelistirme (docker-compose.yml, bind-mount + watch, `target: dev`) ----
FROM deps AS dev

COPY . .

# T-026 (perf P-01/P-02): libuv is-parcacigi havuzu ACIKCA ayarlanir. `sharp` (fotograf
# yeniden kodlama) ve `bcrypt` (giris) senkron CPU islerini bu havuzda kosar; Node'un
# varsayilani 4'tur ve hedef eszamanlilikta (30 aktif kullanici, architecture.md §6)
# yukleme/PDF istekleri bu 4 parcacikta kuyruklanip p95 butcelerini kirar.
# Deger 8: uretim hedefi 2 vCPU (architecture.md §5.1) oldugu icin daha yuksek bir sayi
# ek islem gucu getirmez, yalnizca ayni anda bellekte tutulan fotograf tamponunu ve
# baglam degisimini artirir; 8, CPU'yu bekleyen isi kuyruktan cikarmaya yeter ve
# 4 GB'lik sunucuda bellek tavanini zorlamaz. Deger koda GOMULMEZ, imajda durur.
ENV UV_THREADPOOL_SIZE=8

EXPOSE 3000

CMD ["npm", "run", "start:dev", "--workspace", "@tutanak/api"]

# ---- build: TypeScript derlemesi (release-prep) ----
FROM deps AS build

COPY . .
RUN npm run build --workspace @tutanak/api

# ---- runtime: uretim imaji (release-prep, docker-compose.e2e.yml + VPS runbook varsayilan
# hedefi kullanir, `docker build` icin acikca --target belirtilmez) ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV UV_THREADPOOL_SIZE=8

# `node_modules` tam olarak (devDependencies dahil) `deps` asamasindan tasinir:
# `prisma migrate deploy` ve `prisma/seed.ts` (node --experimental-strip-types ile
# derlenmeden calistirilir, bkz. CMD) acilista `prisma` CLI'sini (bir devDependency)
# gerektirir. `npm prune --omit=dev` burada UYGULANAMAZ (bilinen sinirlama,
# factory/10-release/devops-report.md'de kayitli); imaj boyutu buna ragmen kucuktur.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json apps/api/
COPY apps/api/prisma/ apps/api/prisma/
COPY package.json ./

EXPOSE 3000

# Acilista once migration + sablon seed (idempotent upsert, prisma/seed.ts basindaki not),
# sonra derlenmis sunucu (docker-compose.yml'deki dev komutunun uretim karsiligi).
# Seed her acilista tekrar kosar ama upsert oldugu icin zararsizdir (kayit sayisi sabit 3 kalir).
CMD ["sh", "-c", "npm run migrate:deploy --workspace @tutanak/api && npm run seed --workspace @tutanak/api && node apps/api/dist/main.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
