FROM node:20-alpine 
# use lower alpine lower memory use
# use latest service for longevity purpose

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
# npm ci ~> clean install
    # installs exact versions from package-lock.json
    # deletes existing node_modules first
# --omit=dev
    # skip devDependencies
    # installs only production dependencies
# 

COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# addgroup -S appgroup
    # creates a system group called appgroup
    # -S = system group (not normal login group)
# adduser -S appuser -G appgroup
    # creates a system user called appuser
    # -S = system user (no login, lightweight)
    # -G appgroup = assign user to that group
# 

USER appuser

EXPOSE 3000

CMD ["node", "src/app.js"]