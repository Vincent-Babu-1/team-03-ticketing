import express from 'express';
import { waitForPg, waitForRedis } from './wait.js';
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
await waitForRedis(redis, 'posts');
