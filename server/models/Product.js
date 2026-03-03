// File: server/models/Product.js

import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required."],
      trim: true,
      maxlength: [120, "Product name must not exceed 120 characters."],
    },

    brand: {
      type: String,
      required: [true, "Brand is required."],
      trim: true,
      maxlength: [60, "Brand name must not exceed 60 characters."],
    },

    price: {
      type: Number,
      required: [true, "Price is required."],
      min: [0, "Price cannot be negative."],
    },

    originalPrice: {
      type: Number,
      default: null,
      min: [0, "Original price cannot be negative."],
    },

    sizes: {
      type: [String],
      enum: {
        values: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
        message: "{VALUE} is not a valid size.",
      },
      default: [],
    },

    image: {
      type: String,
      default: "https://placehold.co/400x480/1F6F50/FFFFFF?text=Jersey",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Description must not exceed 1000 characters."],
    },

    badge: {
      type: String,
      enum: {
        values: ["New", "Sale", "Limited", "Retro", null],
        message: "{VALUE} is not a valid badge.",
      },
      default: null,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    inStock: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ name: "text", description: "text" }); // full-text search ready

// ─── Virtual: discountPercent ──────────────────────────────────────────────
productSchema.virtual("discountPercent").get(function () {
  if (!this.originalPrice || this.originalPrice <= this.price) return null;
  return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
});

const Product = mongoose.model("Product", productSchema);

export default Product;
