// File: server/config/db.js

import mongoose from "mongoose";

/**
 * Establishes a connection to MongoDB using the MONGO_URI environment variable.
 * Exits the process on failure so the server does not start in a broken state.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅  MongoDB connected: ${conn.connection.host} [${conn.connection.name}]`);

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️   MongoDB connection lost. Reconnecting…");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔄  MongoDB reconnected.");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌  MongoDB connection error:", err.message);
    });
  } catch (error) {
    console.error(`❌  MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
