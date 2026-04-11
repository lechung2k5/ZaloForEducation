import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  constructor() {
    const url = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || '6379';
    const password = process.env.REDIS_PASSWORD;

    this.client = createClient({
      url: url || `redis://${host}:${port}`,
      password: password,
      socket: {
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 100, 10000); // Exponential backoff max 10s
          console.warn(`[Redis] Connection failed. Retrying in ${delay}ms... (Attempt ${retries})`);
          return delay;
        },
        connectTimeout: 10000,
      },
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.client.on('connect', () => console.log('[Redis] Connecting to server...'));
    this.client.on('ready', () => console.log('[Redis] Client is ready and authenticated.'));
    this.client.on('reconnecting', () => console.warn('[Redis] Client is trying to reconnect...'));
    this.client.on('error', (err) => console.error('[Redis] Client Error:', err.message));
    this.client.on('end', () => console.warn('[Redis] Client connection closed.'));
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (err) {
      console.error('[Redis] Initial connection failed:', err.message);
      // We don't throw here to allow NestJS to start; reconnectStrategy will handle it.
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      await this.client.set(key, value, {
        EX: ttlSeconds,
      });
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    const value = await this.client.get(key);
    return value as string | null;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async sAdd(key: string, value: string) {
    await this.client.sAdd(key, value);
  }

  async sMembers(key: string): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  async sRem(key: string, value: string) {
    await this.client.sRem(key, value);
  }

  async expire(key: string, seconds: number) {
    await this.client.expire(key, seconds);
  }
}
