// File: server/routes/productRoutes.js

import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

const router = Router();

// ─── /api/products ─────────────────────────────────────────────────────────
router
  .route("/")
  .get(getProducts)    // GET  /api/products  — list with filter/sort/pagination
  .post(createProduct); // POST /api/products  — create new product

// ─── /api/products/:id ─────────────────────────────────────────────────────
router
  .route("/:id")
  .get(getProductById)    // GET    /api/products/:id — single product
  .put(updateProduct)     // PUT    /api/products/:id — full update
  .delete(deleteProduct); // DELETE /api/products/:id — remove product

export default router;
