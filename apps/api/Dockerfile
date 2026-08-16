# Yerel gelistirme ve uretim icin tek asamali basit imaj (iskelet — T-001).
FROM node:22-alpine

WORKDIR /app

# Workspace manifestleri once kopyalanir: bagimlilik katmani onbelleklenir.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Prisma semasi bagimlilik kurulumundan ONCE kopyalanir: apps/api postinstall adimi
# (prisma generate) semaya ihtiyac duyar (T-002).
COPY apps/api/prisma/ apps/api/prisma/
RUN npm ci

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
