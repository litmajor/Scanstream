# Use official Node.js LTS image
FROM node:22-bullseye

# Install build dependencies for canvas and esbuild
RUN apt-get update && apt-get install -y \
	python3 make g++ pkg-config curl \
	libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app


# 1️⃣ copy dependency manifests
COPY package.json pnpm-lock.yaml* ./

# 2️⃣ install **all** deps (prod + dev)
RUN corepack enable && pnpm install

# 3️⃣ copy source & schema
COPY . .

# 4️⃣ generate the client **after** everything is in place
RUN npx prisma generate

# 5️⃣ rebuild native binaries (optional but safe)
RUN pnpm rebuild esbuild

EXPOSE 3000

CMD ["pnpm", "run", "server"]
