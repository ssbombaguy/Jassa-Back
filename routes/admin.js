import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { pool } from '../db.js';

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req) => ({
    folder: `jasssport/${req.query.type || 'jerseys'}`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1500, crop: 'limit', quality: 'auto:good' }],
    public_id: `${req.query.type}_${req.query.id}_${req.query.label || 'front'}_${Date.now()}`,
  }),
});

const upload = multer({ storage });

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { type = 'jerseys', id, label = 'front', sort_order = 0 } = req.query;
    if (!id)       return res.status(400).json({ success: false, error: 'id is required' });
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const imageUrl = req.file.path;

    if (type === 'jerseys') {
      await pool.query(
        `INSERT INTO jersey_images (jersey_id, image_url, sort_order, label) VALUES ($1, $2, $3, $4)`,
        [id, imageUrl, sort_order, label]
      );
      if (Number(sort_order) === 0) {
        await pool.query('UPDATE jerseys SET image_url = $1 WHERE jersey_id = $2', [imageUrl, id]);
      }
    } else if (type === 'products') {
      await pool.query(
        `INSERT INTO product_images (product_id, image_url, sort_order, label) VALUES ($1, $2, $3, $4)`,
        [id, imageUrl, sort_order, label]
      );
      if (Number(sort_order) === 0) {
        await pool.query('UPDATE products SET image_url = $1 WHERE product_id = $2', [imageUrl, id]);
      }
    } else if (type === 'leagues') {
      await pool.query('UPDATE leagues SET image_url = $1 WHERE league_id = $2', [imageUrl, id]);
    } else if (type === 'clubs') {
      await pool.query('UPDATE clubs SET image_url = $1 WHERE club_id = $2', [imageUrl, id]);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    res.json({ success: true, image_url: imageUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/image/:imageId', async (req, res) => {
  try {
    const { type = 'jerseys' } = req.query;
    const { imageId } = req.params;

    let result;
    if (type === 'jerseys') {
      result = await pool.query('DELETE FROM jersey_images WHERE image_id = $1 RETURNING *', [imageId]);
    } else {
      result = await pool.query('DELETE FROM product_images WHERE image_id = $1 RETURNING *', [imageId]);
    }

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    const deleted = result.rows[0];
    try {
      const publicId = deleted.image_url.split('/').slice(-1)[0].split('.')[0];
      await cloudinary.uploader.destroy(`jasssport/${type}/${publicId}`);
    } catch (_) { /* ignore */ }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/items', async (req, res) => {
  try {
    const { type = 'jerseys' } = req.query;
    let result;

    if (type === 'jerseys') {
      result = await pool.query(`
        SELECT j.jersey_id AS id, j.name, j.image_url, j.jersey_type,
               c.club_name, c.club_id, l.league_name,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'image_id', ji.image_id,
                     'image_url', ji.image_url,
                     'label', ji.label,
                     'sort_order', ji.sort_order
                   ) ORDER BY ji.sort_order
                 ) FILTER (WHERE ji.image_id IS NOT NULL),
                 '[]'
               ) AS images
        FROM jerseys j
        LEFT JOIN clubs c ON j.club_id = c.club_id
        LEFT JOIN leagues l ON c.league_id = l.league_id
        LEFT JOIN jersey_images ji ON j.jersey_id = ji.jersey_id
        GROUP BY j.jersey_id, c.club_name, c.club_id, l.league_name
        ORDER BY l.league_name, c.club_name, j.jersey_type
      `);
    } else if (type === 'products') {
      result = await pool.query(`
        SELECT p.product_id AS id, p.name, p.image_url,
               b.name AS brand_name, cat.name AS category_name,
               sub.name AS subcategory_name,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'image_id', pi.image_id,
                     'image_url', pi.image_url,
                     'label', pi.label,
                     'sort_order', pi.sort_order
                   ) ORDER BY pi.sort_order
                 ) FILTER (WHERE pi.image_id IS NOT NULL),
                 '[]'
               ) AS images
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.brand_id
        LEFT JOIN subcategories sub ON p.subcategory_id = sub.subcategory_id
        LEFT JOIN categories cat ON sub.category_id = cat.category_id
        LEFT JOIN product_images pi ON p.product_id = pi.product_id
        GROUP BY p.product_id, b.name, cat.name, sub.name
        ORDER BY cat.name, b.name, p.name
      `);
    } else if (type === 'leagues') {
      result = await pool.query(`
        SELECT league_id AS id, league_name AS name, image_url, country
        FROM leagues ORDER BY league_name
      `);
    } else if (type === 'clubs') {
      result = await pool.query(`
        SELECT c.club_id AS id, c.club_name AS name, c.image_url,
               l.league_name
        FROM clubs c
        LEFT JOIN leagues l ON c.league_id = l.league_id
        ORDER BY l.league_name, c.club_name
      `);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;