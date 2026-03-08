import express from "express";
import { query } from "../db.js";
import { buildPagination, parsePaginationParams } from "../utils/query.js";

const router = express.Router();

const getHeaderNav = async () => {
  const parentResult = await query(
    `SELECT * FROM nav_items WHERE is_active = true AND section = 'header'AND parent_id IS NULL ORDER BY position, nav_id`,
  );
  const childResult = await query(
    `SELECT * FROM nav_items WHERE is_active = true AND section = 'header' AND parent_id IS NOT NULL ORDER BY position, nav_id`,
  );

  const childMap = childResult.rows.reduce((acc, item) => {
    if (!acc[item.parent_id]) acc[item.parent_id] = [];
    acc[item.parent_id].push(item);
    return acc;
  }, {});

  return parentResult.rows.map((item) => ({
    ...item,
    children: childMap[item.nav_id] || [],
  }));
};

const getFooterNav = async () => {
  const result = await query(
    `SELECT *
    FROM nav_items
    WHERE is_active = true
      AND section = 'footer'
    ORDER BY footer_group, position, nav_id`,
  );

  return result.rows.reduce((acc, item) => {
    const group = item.footer_group || "Other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
};

router.get("/", async (req, res) => {
  try {
    const section = req.query.section;

    if (section && !["header", "footer"].includes(section)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid section parameter" });
    }

    if (section === "header") {
      const data = await getHeaderNav();
      const paging = parsePaginationParams(req.query);
      if (paging.error) {
        return res.status(400).json({ success: false, error: paging.error });
      }

      const pagination = buildPagination(1, data.length || 20, data.length);
      return res.json({
        success: true,
        data,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages: pagination.totalPages,
        },
      });
    }

    if (section === "footer") {
      const data = await getFooterNav();
      return res.json({ success: true, data });
    }

    const [header, footer] = await Promise.all([
      getHeaderNav(),
      getFooterNav(),
    ]);
    return res.json({ success: true, data: { header, footer } });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
});

router.get("/header", async (req, res) => {
  try {
    const data = await getHeaderNav();
    const pagination = buildPagination(1, data.length || 20, data.length);

    return res.json({
      success: true,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
});

router.get("/footer", async (_req, res) => {
  try {
    const data = await getFooterNav();
    return res.json({ success: true, data });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
});

export default router;
