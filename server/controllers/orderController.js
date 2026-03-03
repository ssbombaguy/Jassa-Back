// File: server/controllers/orderController.js

import Order from "../models/Order.js";
import Product from "../models/Product.js";
import asyncHandler from "../utils/asyncHandler.js";

// ─── POST /api/orders ──────────────────────────────────────────────────────
/**
 * @desc    Place a new order
 *          - Validates each product exists and is in stock
 *          - Snapshots current product data into line items
 *          - Calculates total price server-side (never trust client)
 * @route   POST /api/orders
 * @access  Public
 */
const createOrder = asyncHandler(async (req, res) => {
  const { customerName, email, phone, address, items, notes } = req.body;

  // ── Basic field validation ────────────────────────────────────────────────
  if (!customerName || !phone || !address) {
    res.status(400);
    throw new Error("customerName, phone, and address are required fields.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("Order must contain at least one item.");
  }

  // ── Validate & enrich each line item ─────────────────────────────────────
  const enrichedItems = [];
  let serverCalculatedTotal = 0;

  for (const item of items) {
    const { productId, size, quantity } = item;

    if (!productId || !size || !quantity) {
      res.status(400);
      throw new Error("Each item must include productId, size, and quantity.");
    }

    if (typeof quantity !== "number" || quantity < 1) {
      res.status(400);
      throw new Error(`Invalid quantity (${quantity}) for product ${productId}.`);
    }

    const product = await Product.findById(productId);

    if (!product) {
      res.status(404);
      throw new Error(`Product not found: ${productId}`);
    }

    if (!product.inStock) {
      res.status(400);
      throw new Error(`Product "${product.name}" is currently out of stock.`);
    }

    if (!product.sizes.includes(size)) {
      res.status(400);
      throw new Error(
        `Size "${size}" is not available for "${product.name}". Available: ${product.sizes.join(", ")}`
      );
    }

    const lineTotal = product.price * quantity;
    serverCalculatedTotal += lineTotal;

    enrichedItems.push({
      productId:  product._id,
      name:       product.name,
      brand:      product.brand,
      image:      product.image,
      size,
      quantity,
      unitPrice:  product.price,
    });
  }

  // ── Create the order ───────────────────────────────────────────────────────
  const order = await Order.create({
    customerName,
    email:      email ?? null,
    phone,
    address,
    items:      enrichedItems,
    totalPrice: parseFloat(serverCalculatedTotal.toFixed(2)),
    notes:      notes ?? "",
    status:     "pending",
  });

  res.status(201).json({
    success: true,
    message: "Order placed successfully.",
    data: order,
  });
});

// ─── GET /api/orders ───────────────────────────────────────────────────────
/**
 * @desc    Retrieve all orders with optional filtering and pagination
 * @route   GET /api/orders
 * @access  Admin (auth middleware to be added)
 */
const getOrders = asyncHandler(async (req, res) => {
  const {
    status,
    page   = 1,
    limit  = 20,
    sort   = "createdAt",
    order  = "desc",
    search,
  } = req.query;

  const filter = {};

  if (status) {
    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      res.status(400);
      throw new Error(`Invalid status filter. Must be one of: ${validStatuses.join(", ")}`);
    }
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      { customerName: { $regex: search, $options: "i" } },
      { phone:        { $regex: search, $options: "i" } },
      { email:        { $regex: search, $options: "i" } },
    ];
  }

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const validSortFields = ["createdAt", "totalPrice", "status", "customerName"];
  const sortField = validSortFields.includes(sort) ? sort : "createdAt";
  const sortOrder = order === "asc" ? 1 : -1;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count:   orders.length,
    total,
    page:    pageNum,
    pages:   Math.ceil(total / limitNum),
    data:    orders,
  });
});

// ─── GET /api/orders/:id ───────────────────────────────────────────────────
/**
 * @desc    Retrieve a single order by id
 * @route   GET /api/orders/:id
 * @access  Admin
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "items.productId",
    "name brand image price inStock"
  );

  if (!order) {
    res.status(404);
    throw new Error(`Order not found with id: ${req.params.id}`);
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

// ─── PATCH /api/orders/:id/status ─────────────────────────────────────────
/**
 * @desc    Update order status
 * @route   PATCH /api/orders/:id/status
 * @access  Admin
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error(`Order not found with id: ${req.params.id}`);
  }

  order.status = status;
  const updated = await order.save();

  res.status(200).json({
    success: true,
    message: `Order status updated to "${status}".`,
    data: updated,
  });
});

export { createOrder, getOrders, getOrderById, updateOrderStatus };
