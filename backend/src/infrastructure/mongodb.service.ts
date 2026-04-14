import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Collection, Db, MongoClient } from 'mongodb';

@Injectable()
export class MongoDBService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async onModuleInit() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    this.client = new MongoClient(uri);
    await this.client.connect();

    const dbName = process.env.MONGODB_DB_NAME || 'zaloedu-rag';
    this.db = this.client.db(dbName);

    console.log(`✅ MongoDB connected to database: ${dbName}`);

    // Ensure collections and indexes exist
    await this.ensureCollections();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      console.log('✅ MongoDB connection closed');
    }
  }

  private async ensureCollections() {
    if (!this.db) throw new Error('Database not initialized');

    // Collection: documents (chunk metadata + embeddings)
    await this.db.createCollection('chunks').catch(() => {
      /* Collection already exists */
    });

    // Create vector search index (MongoDB 7.0+)
    const chunksCollection = this.db.collection('chunks');
    await chunksCollection.createIndex({ embedding: '2dsphere' }).catch(() => {
      /* Index already exists */
    });

    // Metadata indexes
    await chunksCollection.createIndex({ docId: 1 }).catch(() => { });
    await chunksCollection.createIndex({ subject: 1, grade: 1 }).catch(() => { });
    await chunksCollection.createIndex({ createdAt: -1 }).catch(() => { });

    // Collection: documents (metadata for uploaded files)
    await this.db.createCollection('documents').catch(() => {
      /* Collection already exists */
    });
    const docsCollection = this.db.collection('documents');
    await docsCollection.createIndex({ docId: 1 }).catch(() => { });
    await docsCollection.createIndex({ subject: 1 }).catch(() => { });
    await docsCollection.createIndex({ createdAt: -1 }).catch(() => { });

    console.log('✅ MongoDB collections and indexes ensured');
  }

  getDatabase(): Db {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  getCollection(name: string): Collection {
    const collection = this.db?.collection(name);
    if (!collection) {
      throw new Error(`Collection ${name} not found`);
    }
    return collection;
  }
}
