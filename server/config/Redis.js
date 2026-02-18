import Redis from 'ioredis';

const redis = new Redis(process.env.UPSTSASH_REDIS_URL,{
    tls: {rejectUnauthorized: false}, //abhi developement phase ke lie shi hai but certificate verify krana zaruri hai to prevent middleman pretending to be redis server
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,

});
redis.on('connect', () => console.log('Redis is connected (Upstash)'));
redis.on('error', () => console.error('Redis error:',err));

export default redis;