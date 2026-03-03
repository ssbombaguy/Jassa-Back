// File: server/models/Order.js

import mongoose from "mongoose";

// ─── Sub-schema: individual line item ─────────────────────────────────────
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required for each order item."],
    },
    name: {
      type: String,
      required: [true, "Product name snapshot is required."],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, "Product brand snapshot is required."],
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    size: {
      type: String,
      required: [true, "Size is required for each order item."],
      enum: {
        values: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
        message: "{VALUE} is not a valid size.",
      },
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required for each order item."],
      min: [1, "Quantity must be at least 1."],
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price snapshot is required."],
      min: [0, "Unit price cannot be negative."],
    },
  },
  { _id: false } // No separate _id for sub-documents
);

// ─── Main Order Schema ─────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, "Customer name is required."],
      trim: true,
      maxlength: [100, "Customer name must not exceed 100 characters."],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\S+@\S+\.\S+$/,
        "Please provide a valid email address.",
      ],
      default: null,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required."],
      trim: true,
      maxlength: [30, "Phone number must not exceed 30 characters."],
    },

    address: {
      type: String,
      required: [true, "Delivery address is required."],
      trim: true,
      maxlength: [300, "Address must not exceed 300 characters."],
    },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "An order must contain at least one item.",
      },
    },

    totalPrice: {
      type: Number,
      required: [true, "Total price is required."],
      min: [0, "Total price cannot be negative."],
    },

    status: {
      type: String,
      enum: {
        values: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
        message: "{VALUE} is not a valid order status.",
      },
      default: "pending",
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Notes must not exceed 500 characters."],
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ customerName: "text" });

// ─── Virtual: itemCount ────────────────────────────────────────────────────
orderSchema.virtual("itemCount").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// ─── Pre-save: auto-calculate totalPrice ──────────────────────────────────
orderSchema.pre("save", function (next) {
  if (this.items && this.items.length > 0) {
    this.totalPrice = parseFloat(
      this.items
        .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
        .toFixed(2)
    );
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
