# Build stage
FROM rust:1.75-slim as builder

WORKDIR /app

# Copy manifest files
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/target/release/govtwool-backend /usr/local/bin/govtwool-backend

# Expose port
EXPOSE 8080

# Run the application
CMD ["govtwool-backend"]

