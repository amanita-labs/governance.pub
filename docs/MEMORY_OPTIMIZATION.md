# Memory Optimization Guide for Yaci Store Indexer

## OutOfMemoryError Fix

If you're seeing `java.lang.OutOfMemoryError: Java heap space`, follow these steps:

## Immediate Fixes Applied

### 1. Reduced Batch Size
- **Before**: 2000
- **After**: 1000
- **Impact**: Uses ~50% less memory per batch

### 2. Reduced Parallel Workers
- **Before**: 4 workers
- **After**: 2 workers
- **Impact**: Reduces concurrent memory usage

### 3. Increased Max Heap
- **Before**: 2GB (`-Xmx2g`)
- **After**: 3GB (`-Xmx3g`)
- **Impact**: More headroom for memory spikes

### 4. Reduced Connection Pool
- **Before**: 10 max, 5 min idle
- **After**: 5 max, 2 min idle
- **Impact**: Less memory for connection objects

### 5. Disabled Hibernate Caches
- **Before**: Enabled (default)
- **After**: Disabled
- **Impact**: Saves memory used for caching

## Current Safe Configuration

```yaml
# render.yaml
STORE_BATCH_SIZE: "1000"
STORE_PARALLEL_WORKERS: "2"
SPRING_DATASOURCE_HIKARI_MAX_POOL_SIZE: "5"
SPRING_JPA_BATCH_SIZE: "1000"
JVM_OPTS: "-Xms512m -Xmx3g -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError -XX:+ExitOnOutOfMemoryError"
```

## If Still Getting OOM Errors

### Option 1: Further Reduce Batch Size
```yaml
- key: STORE_BATCH_SIZE
  value: "500"  # Reduce to 500
- key: SPRING_JPA_BATCH_SIZE
  value: "500"  # Match STORE_BATCH_SIZE
```

### Option 2: Reduce Parallel Workers to 1
```yaml
- key: STORE_PARALLEL_WORKERS
  value: "1"  # Single-threaded (slower but safer)
```

### Option 3: Increase Max Heap (if Render plan allows)
```yaml
- key: JVM_OPTS
  value: "-Xms1g -Xmx4g -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
```

**Note**: Check your Render worker plan memory limits before increasing heap size.

## Monitoring Memory Usage

### Check Current Memory Usage
```bash
# In Render logs, look for:
# "Available memory: ..." (from docker-entrypoint.sh)
# Or check Render dashboard → Worker → Metrics → Memory
```

### Check Heap Usage (if GC logging enabled)
Look for GC logs in Render logs:
```
[GC (Allocation Failure) ...]
```

### Monitor Sync Progress
```bash
curl https://govtwool-backend-p9k5.onrender.com/health/indexer | jq '.activity'
```

## Gradual Optimization Strategy

Once sync is stable with current settings:

1. **Week 1**: Keep current settings, monitor for OOM errors
2. **Week 2**: If stable, increase batch size to 1500
3. **Week 3**: If stable, increase parallel workers to 3
4. **Week 4**: If stable, increase batch size to 2000

**Stop increasing if**:
- OOM errors return
- Memory usage > 80% consistently
- GC pauses become frequent (>1 second)

## Render Plan Memory Limits

Check your Render worker plan:

- **Starter Plan**: ~512MB-1GB RAM → Use `-Xmx1g` max
- **Standard Plan**: ~1GB-2GB RAM → Use `-Xmx2g` max
- **Pro Plan**: ~2GB+ RAM → Can use `-Xmx3g` or `-Xmx4g`

**Important**: Leave ~200-500MB for system/OS, so if you have 2GB total, use `-Xmx1.5g` max.

## Alternative: Upgrade Render Plan

If you consistently need more memory:

1. Go to Render Dashboard → Worker Service
2. Click "Settings" → "Plan"
3. Upgrade to a plan with more RAM
4. Then increase `-Xmx` accordingly

## Troubleshooting

### OOM Still Happening After Fixes

1. **Check Render plan limits** - You might be hitting container memory limits
2. **Check for memory leaks** - Look for continuously increasing memory usage
3. **Reduce batch size further** - Try 500 or even 250
4. **Disable non-essential stores** - Temporarily disable stores you don't need:
   ```bash
   # In docker-entrypoint.sh, set:
   store.assets.enabled=false
   store.metadata.enabled=false  # If not needed immediately
   ```

### Slow Sync After Reducing Settings

This is expected - slower sync is better than crashes. Once stable:
- Gradually increase batch size
- Monitor memory usage
- Increase parallel workers if CPU allows

## Expected Performance

### Current Safe Settings
- **Memory Usage**: ~1.5-2.5GB
- **Sync Speed**: ~500-1000 blocks/hour
- **Stability**: High (no OOM errors)

### Optimized Settings (after stability)
- **Memory Usage**: ~2-3GB
- **Sync Speed**: ~1000-2000 blocks/hour
- **Stability**: Medium (monitor closely)

## Summary

The current configuration prioritizes **stability over speed**. Once the indexer runs without OOM errors for a few days, you can gradually increase batch size and workers while monitoring memory usage.
