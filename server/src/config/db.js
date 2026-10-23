import mongoose from 'mongoose';
import env from './env.js';

let isConnected = false;

export const connectDB = async (customUri) => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = customUri || env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true
    });
    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};

export const disconnectDB = async () => {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('🔌 MongoDB disconnected');
  } catch (error) {
    console.error('❌ MongoDB disconnect error:', error.message);
    throw error;
  }
};

export default { connectDB, disconnectDB };
