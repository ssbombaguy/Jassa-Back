// File: server/controllers/productController.js

import Product from "../models/Product.js";
import asyncHandler from "../utils/asyncHandler.js";

// ─── GET /api/products ─────────────────────────────────────────────────────
/**
 * @desc    Fetch all products with optional filtering, sorting, and pagination
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = asyncHandler(async (req, res) => {
  const {
    brand,
    size,
    minPrice,
    maxPrice,
    sort = "createdAt",
    order = "desc",
    page = 1,
    limit = 20,
    search,
    inStock,
  } = req.query;

  // ── Build dynamic filter ──────────────────────────────────────────────────
  const filter = {};

  if (brand) filter.brand = { $regex: brand, $options: "i" };
  if (size)  filter.sizes = { $in: [size] };
  if (inStock !== undefined) filter.inStock = inStock === "true";

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }

  if (search) {
    filter.$or = [
      { name:        { $regex: search, $options: "i" } },
      { brand:       { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  // ── Sort ──────────────────────────────────────────────────────────────────
  const validSortFields = ["price", "name", "createdAt", "rating", "reviews"];
  const sortField = validSortFields.includes(sort) ? sort : "createdAt";
  const sortOrder = order === "asc" ? 1 : -1;
  const sortQuery = { [sortField]: sortOrder };

  // ── Execute ───────────────────────────────────────────────────────────────
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sortQuery).skip(skip).limit(limitNum).lean(),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count:   products.length,
    total,
    page:    pageNum,
    pages:   Math.ceil(total / limitNum),
    data:    products,
  });
});

// ─── GET /api/products/:id ─────────────────────────────────────────────────
/**
 * @desc    Fetch a single product by MongoDB ObjectId
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error(`Product not found with id: ${req.params.id}`);
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

// ─── POST /api/products ────────────────────────────────────────────────────
/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Admin (auth middleware to be added)
 */
const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    brand,
    price,
    originalPrice,
    sizes,
    image,
    description,
    badge,
    rating,
    reviews,
    inStock,
  } = req.body;

  const product = await Product.create({
    name,
    brand,
    price,
    originalPrice: originalPrice ?? null,
    sizes:         sizes ?? [],
    image,
    description,
    badge:         badge ?? null,
    rating:        rating ?? 0,
    reviews:       reviews ?? 0,
    inStock:       inStock ?? true,
  });

  res.status(201).json({
    success: true,
    message: "Product created successfully.",
    data: product,
  });
});

// ─── PUT /api/products/:id ─────────────────────────────────────────────────
/**
 * @desc    Update an existing product by id
 * @route   PUT /api/products/:id
 * @access  Admin (auth middleware to be added)
 */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error(`Product not found with id: ${req.params.id}`);
  }

  const allowedUpdates = [
    "name", "brand", "price", "originalPrice",
    "sizes", "image", "description", "badge",
    "rating", "reviews", "inStock",
  ];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      product[field] = req.body[field];
    }
  });

  const updated = await product.save(); // Triggers validation & hooks

  res.status(200).json({
    success: true,
    message: "Product updated successfully.",
    data: updated,
  });
});

// ─── DELETE /api/products/:id ──────────────────────────────────────────────
/**
 * @desc    Delete a product by id
 * @route   DELETE /api/products/:id
 * @access  Admin (auth middleware to be added)
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error(`Product not found with id: ${req.params.id}`);
  }

  await product.deleteOne();

  res.status(200).json({
    success: true,
    message: "Product deleted successfully.",
    data: { id: req.params.id },
  });
});

export {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
