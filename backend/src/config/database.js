/**
 * MongoDB Database Configuration
 *
 * Connects to MongoDB and exports database instance.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cryoprocess-db';

// MongoDB connection options
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, options);
    logger.info('[MongoDB] Connected to database');
    return mongoose.connection;
  } catch (error) {
    logger.error('[MongoDB] Connection failed:', error.message);
    throw error;
  }
};

/**
 * Get the native MongoDB database instance
 */
const getDB = () => mongoose.connection.db;

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  await mongoose.disconnect();
  logger.info('[MongoDB] Disconnected');
};

// Handle connection events
mongoose.connection.on('error', (err) => {
  logger.error('[MongoDB] Connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('[MongoDB] Disconnected');
});

module.exports = {
  connectDB,
  getDB,
  disconnectDB,
  mongoose
};
