import express from 'express';
import { waitForPg, waitForRedis } from './wait.js';

await waitForRedis(redis, 'posts');
