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

RUN addgroup -S appgroup && adduser -S -H -D -u 4000 -G appgroup appuser
# addgroup -S appgroup
    # creates a system group called appgroup
# adduser -S -H -D -u 4000 -G appgroup appuser
    # add user called appuser
    # -S = system user (no login, lightweight)
    # -H = no home directory (purely for user to exist to run the app)
    # -D = no password
    # -u 4000 = user ID ~> 4000
    # -G appgroup = assign user to that group
# 

RUN chown -R appuser:appgroup /app && chmod -R 755 /app
# chown -R appuser:appgroup /app
    # chown = change owner
    # -R = recursive (everything inside /app)
    # appuser:appgroup = new owner
    # result: make appuser the owner of all files in /app
# chmod = change permissions
    # 755:
        # owner, permission: read, write, execute
        # group, permission: read, execute
        # others, permission: read, execute
# 

USER appuser

EXPOSE 3000

CMD ["node", "src/app.js"]