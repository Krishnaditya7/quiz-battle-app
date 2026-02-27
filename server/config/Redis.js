import Redis from 'ioredis';

const redis = new Redis(process.env.UPSTSASH_REDIS_URL,{
    tls: {rejectUnauthorized: false}, //abhi developement phase ke lie shi hai but certificate verify krana zaruri hai to prevent middleman pretending to be redis server
    maxRetriesPerRequest: 3,         //Command-Specific Limit: Unlike retryStrategy (which handles the total connection reconnect attempts), maxRetriesPerRequest applies to individual requests. If a command fails and the connection reestablishes, the command will retry up to this limit before returning a rejection.
    enableReadyCheck: false,         //ensures the client waits until the Redis server is fully loaded and ready to process commands, rather than just connected

});
redis.on('connect', () => console.log('Redis is connected (Upstash)'));
redis.on('error', () => console.error('Redis error:',err));

export default redis;