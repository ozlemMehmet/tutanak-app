# syntax=docker/dockerfile:1
# Uretim imaji (devops-agent, release-prep). Statik PWA build + Caddy tek imajda:
# architecture.md §5.1 karari geregi web, ayri bir CDN/servis degil, ayni VPS'te Caddy
# tarafindan servis edilir ve `/api/*` istekleri API container'ina ters vekillenir.
# `apps/web/vite.config.ts` build ciktisi zaten ayni-kaynak `/api/v1` cagirir (CORS gerekmez),
# bu yuzden build asamasinda VITE_* ortam degiskeni gerekmez.

# ---- build: Vite production derlemesi ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
# apps/api'nin postinstall'i (`prisma generate`) workspace kurulumunda otomatik calisir;
# semaya ihtiyac duyar (apps/api/Dockerfile'daki ayni gerekce, T-002).
COPY apps/api/prisma/ apps/api/prisma/
RUN npm ci
COPY tsconfig.json ./
COPY apps/web apps/web
RUN npm run build --workspace @tutanak/web

# ---- runtime: Caddy statik dosya sunumu + /api ters vekil ----
# Caddy yapilandirmasi ayri bir dosya olarak degil (repo kokunde devops-agent'a acik olmayan
# bir yeni dosya adi olurdu), imaja gomulu heredoc olarak tutulur — imaj kendi kendine
# yeterlidir, sunucuda ayrica bir yapilandirma dosyasi elle olusturulmasi gerekmez.
FROM caddy:2-alpine AS runtime
COPY --from=build /app/apps/web/dist /srv
# APP_DOMAIN gercek bir alan adiyla verildiginde (ör. app.ornek.com) Caddy otomatik HTTPS
# saglar (Let's Encrypt); verilmezse ":80" varsayilanina duser (TLS'siz duman testi/e2e).
COPY <<'CADDYFILE' /etc/caddy/Caddyfile
{$APP_DOMAIN::80} {
	encode zstd gzip

	# architecture.md §7: yetenek (capability) linkli genel goruntuleme sayfasi (`/t/:token`)
	# arama motorlarinca indekslenmemeli ve referrer sizdirmamali. Ayni kural genel API
	# ucuna (`/api/v1/public/*`) da uygulanir — ikisi de token'la erisilen "sayfa"dir.
	@public path /t/* /api/v1/public/*
	header @public {
		X-Robots-Tag "noindex"
		Referrer-Policy "no-referrer"
	}

	# API her zaman /api/* altinda API container'ina gider (CLAUDE.md §1: global onek /api/v1).
	# `/health` bilincli olarak ayni onegin DISINDA (architecture.md §10 T-001 satiri) — dis
	# izleme (runbook §4 UptimeRobot) ve deploy sonrasi duman testi bu ucu kullanir, bu yuzden
	# o da API container'ina gitmek ZORUNDA; yoksa SPA fallback'i (asagida) devreye girer ve
	# `/health` sessizce 200 + index.html dondurur (gercek bir regresyon, bu turda yakalandi).
	@api path /api/* /health
	handle @api {
		reverse_proxy api:3000
	}

	# Kalan her sey statik SPA build'idir; bilinmeyen rotalar index.html'e duser
	# (react-router client-side routing, T-001 PWA iskeleti).
	handle {
		root * /srv
		try_files {path} /index.html
		file_server

		# T-024 / guvenlik denetimi S-02: JS'i CALISTIRAN koken (SPA belgesi + varliklari)
		# hicbir guvenlik basligi tasimiyordu; `helmet` yalnizca API yanitlarinda calisiyor.
		# architecture.md, erisim tokeninin `localStorage`'da tutulmasini acikca "kati CSP"
		# telafi kontrolune dayandiriyor — o kontrol burasidir. API yanitlarinin basliklarina
		# DOKUNULMAZ: `/api/*` ve `/health` yukaridaki `handle @api` blogunda vekillenir.
		#
		# Obje depolama kokeni CSP metnine KODA GOMULU yazilmaz (CLAUDE.md §5.1): fotograflar
		# on-imzali URL ile R2/MinIO kokeninden gelir ve bu adres, API'nin imzalarken
		# kullandigi `R2_PUBLIC_ENDPOINT` ile AYNI olmak zorundadir — web container'ina ayni
		# deger verilmelidir. Verilmezse yer tutucu bos genisler: CSP gecerli kalir ama
		# fotograflar tarayicida engellenir.
		# `blob:` fotograf onizlemesi icindir (PhotoCaptureInput `URL.createObjectURL` kullanir);
		# `data:` ikon/gomulu kucuk gorseller icin birakilmistir. Inline script/style YOKTUR,
		# bu yuzden 'unsafe-inline' HICBIR yonergede verilmez.
		header {
			Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: {$R2_PUBLIC_ENDPOINT}; connect-src 'self' {$R2_PUBLIC_ENDPOINT}"
			Strict-Transport-Security "max-age=31536000; includeSubDomains"
			X-Content-Type-Options "nosniff"
			Referrer-Policy "no-referrer"
		}

		# Service worker/manifest her zaman en guncel halinin gelmesi icin onbelleklenmez
		# (vite-plugin-pwa `registerType: autoUpdate` ile calisir, T-001).
		header /sw.js Cache-Control "no-cache"
		header /manifest.webmanifest Cache-Control "no-cache"
	}
}
CADDYFILE
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1
