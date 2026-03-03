// File: server/seed/seedProducts.js

import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import connectDB from "../config/db.js";

const seedData = [
  {
    name: "FC United Home Jersey 2024",
    brand: "StrikeKit",
    price: 79.99,
    originalPrice: 99.99,
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    image: "https://placehold.co/400x480/1F6F50/FFFFFF?text=FCU+Home",
    description: "Official home jersey for the 2024 season. Lightweight moisture-wicking fabric built for the modern game.",
    badge: "New",
    rating: 4.8,
    reviews: 124,
    inStock: true,
  },
  {
    name: "Champions Away Strip",
    brand: "Veloce",
    price: 64.99,
    originalPrice: null,
    sizes: ["S", "M", "L", "XL"],
    image: "https://placehold.co/400x480/2E8B57/FFFFFF?text=Champions+Away",
    description: "Sleek away strip designed for away day dominance. Breathable mesh panels and tailored performance fit.",
    badge: null,
    rating: 4.5,
    reviews: 89,
    inStock: true,
  },
  {
    name: "Pro League Training Jersey",
    brand: "StrikeKit",
    price: 44.99,
    originalPrice: 59.99,
    sizes: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
    image: "https://placehold.co/400x480/4CAF50/FFFFFF?text=Pro+Training",
    description: "High-performance training jersey used by top flight squads across Europe. Durable, light, and fast-drying.",
    badge: "Sale",
    rating: 4.3,
    reviews: 210,
    inStock: true,
  },
  {
    name: "Euro Elite Match Shirt",
    brand: "Apex Sport",
    price: 89.99,
    originalPrice: null,
    sizes: ["S", "M", "L"],
    image: "https://placehold.co/400x480/1B4332/FFFFFF?text=Euro+Elite",
    description: "Match-grade shirt worn by European elite clubs. Engineered with VaporTech fabric for peak 90-minute performance.",
    badge: "Limited",
    rating: 4.9,
    reviews: 56,
    inStock: true,
  },
  {
    name: "Grassroots Club Jersey",
    brand: "Veloce",
    price: 34.99,
    originalPrice: null,
    sizes: ["XS", "S", "M", "L", "XL"],
    image: "https://placehold.co/400x480/388E3C/FFFFFF?text=Grassroots",
    description: "Affordable, hard-wearing jersey for grassroots clubs. Machine washable, colour-fast, and built to last a season.",
    badge: null,
    rating: 4.1,
    reviews: 305,
    inStock: true,
  },
  {
    name: "National Pride Home Kit",
    brand: "NationGear",
    price: 74.99,
    originalPrice: 84.99,
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: "https://placehold.co/400x480/66BB6A/1B4332?text=National+Home",
    description: "Celebrate your nation with this iconic home kit. Embroidered crest, slim fit, premium quality.",
    badge: "Sale",
    rating: 4.6,
    reviews: 178,
    inStock: true,
  },
  {
    name: "Academy Junior Jersey",
    brand: "Apex Sport",
    price: 29.99,
    originalPrice: null,
    sizes: ["XS", "S", "M"],
    image: "https://placehold.co/400x480/A5D6A7/1B4332?text=Academy+Junior",
    description: "Designed for young players starting their football journey. Soft, comfortable fabric with reinforced stitching.",
    badge: null,
    rating: 4.4,
    reviews: 92,
    inStock: true,
  },
  {
    name: "Retro Classic 90s Jersey",
    brand: "HeritageFC",
    price: 54.99,
    originalPrice: null,
    sizes: ["S", "M", "L", "XL"],
    image: "https://placehold.co/400x480/1F6F50/E8F5E9?text=Retro+Classic",
    description: "A faithful recreation of the iconic 90s strip. Cotton-blend fabric with embroidered vintage badge — a collector's piece.",
    badge: "Retro",
    rating: 4.7,
    reviews: 143,
    inStock: true,
  },
  {
    name: "Goalkeeper Pro Long Sleeve",
    brand: "StrikeKit",
    price: 69.99,
    originalPrice: null,
    sizes: ["M", "L", "XL", "XXL"],
    image: "https://placehold.co/400x480/2E7D32/FFFFFF?text=Goalkeeper+Pro",
    description: "Padded elbows, grippy cuffs, and a long-sleeve cut built for the last line of defence.",
    badge: "New",
    rating: 4.6,
    reviews: 67,
    inStock: true,
  },
  {
    name: "Women's Elite Match Jersey",
    brand: "NationGear",
    price: 59.99,
    originalPrice: 74.99,
    sizes: ["XS", "S", "M", "L", "XL"],
    image: "https://placehold.co/400x480/81C784/1B4332?text=Womens+Elite",
    description: "Purpose-built for the women's game. Contoured fit, stretch panels, and a bold green colourway.",
    badge: "Sale",
    rating: 4.8,
    reviews: 201,
    inStock: true,
  },
];

const seed = async () => {
  await connectDB();

  const isDestroy = process.argv.includes("--destroy");

  try {
    if (isDestroy) {
      await Product.deleteMany({});
      console.log("All products deleted.");
    } else {
      await Product.deleteMany({});
      console.log("Existing products cleared.");
      const inserted = await Product.insertMany(seedData);
      console.log("Seeded " + inserted.length + " products into the database.");
    }
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
    process.exit();
  }
};

seed();
