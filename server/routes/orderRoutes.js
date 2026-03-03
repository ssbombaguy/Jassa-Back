// File: server/routes/orderRoutes.js

import { Router } from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = Router();

// ─── /api/orders ───────────────────────────────────────────────────────────
router
  .route("/")
  .get(getOrders)     // GET  /api/orders  — list all orders (admin)
  .post(createOrder); // POST /api/orders  — place a new order

// ─── /api/orders/:id ───────────────────────────────────────────────────────
router
  .route("/:id")
  .get(getOrderById); // GET /api/orders/:id — single order detail

// ─── /api/orders/:id/status ────────────────────────────────────────────────
router
  .route("/:id/status")
  .patch(updateOrderStatus); // PATCH /api/orders/:id/status — update status

export default router;
