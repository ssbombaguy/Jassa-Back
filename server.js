import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import leaguesRouter from './routes/leagues.js';
import clubsRouter from './routes/clubs.js';
import jerseysRouter from './routes/jerseys.js';
import productsRouter from './routes/products.js';
import bootsRouter from './routes/boots.js';
import categoriesRouter, {
  subcategoriesHandler,
  subcategoryProductsHandler,
} from './routes/categories.js';
import brandsRouter from './routes/brands.js';
import navRouter from './routes/nav.js';
import searchRouter, { featuredHandler } from './routes/search.js';
import adminRouter from './routes/admin.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(
  cors({
    origin: 'http://localhost:5173',
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'JassSport API running' });
});
app.use('/api/admin', adminRouter);
app.use('/api/leagues', leaguesRouter);
app.use('/api/clubs', clubsRouter);
app.use('/api/jerseys', jerseysRouter);
app.use('/api/products', productsRouter);
app.use('/api/boots', bootsRouter);
app.use('/api/categories', categoriesRouter);
app.get('/api/subcategories', subcategoriesHandler);
app.get('/api/subcategories/:slug/products', subcategoryProductsHandler);
app.use('/api/brands', brandsRouter);
app.use('/api/nav', navRouter);
app.use('/api/search', searchRouter);

app.get('/api/featured', featuredHandler);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
