/**
 * Database Configuration
 * 
 * This module handles MongoDB connection using Mongoose.
 * It provides a reusable database connection function that can be
 * called during application startup.
 */

const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * 
 * @returns {Promise<void>} Resolves when connection is successful
 * @throws {Error} If connection fails
 */
const connectDatabase = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${connection.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDatabase };
