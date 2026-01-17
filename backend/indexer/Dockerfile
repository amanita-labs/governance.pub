# Yaci Store Dockerfile for Render Deployment
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Install bash and gettext (for envsubst)
RUN apk add --no-cache bash gettext

# Copy Yaci Store JAR
COPY yaci-store-all-*.jar yaci-store.jar

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
