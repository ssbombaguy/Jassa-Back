import { body, validationResult } from 'express-validator';

/**
 * Validation rules for POST /api/jerseys
 */
export const validateJerseyCreate = [
  body('club_id')
    .isInt({ min: 1 })
    .withMessage('club_id must be a positive integer'),

  body('league_id')
    .isInt({ min: 1 })
    .withMessage('league_id must be a positive integer'),

  body('product_code')
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage('product_code must be 5-20 characters')
    .matches(/^\S+$/)
    .withMessage('product_code must not contain spaces'),

  body('season')
    .matches(/^\d{4}\/\d{2}$/)
    .withMessage('season must match format YYYY/YY (e.g., 2024/25)'),

  body('jersey_type')
    .isIn(['home', 'away', 'third', 'goalkeeper'])
    .withMessage('jersey_type must be one of: home, away, third, goalkeeper'),

  body('name')
    .trim()
    .isLength({ max: 150 })
    .withMessage('name must not exceed 150 characters')
    .notEmpty()
    .withMessage('name is required'),

  body('price_usd')
    .isFloat({ min: 1, max: 999 })
    .withMessage('price_usd must be a number between 1 and 999')
    .notEmpty()
    .withMessage('price_usd is required'),

  body('technology')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('technology must not exceed 50 characters'),

  body('in_stock')
    .optional()
    .isBoolean()
    .withMessage('in_stock must be a boolean'),

  body('release_date')
    .optional()
    .isISO8601()
    .withMessage('release_date must be a valid ISO 8601 date'),
];

/**
 * Validation rules for PUT /api/jerseys/:id
 * All fields are optional for partial updates
 */
export const validateJerseyUpdate = [
  body('club_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('club_id must be a positive integer'),

  body('league_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('league_id must be a positive integer'),

  body('product_code')
    .optional()
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage('product_code must be 5-20 characters')
    .matches(/^\S+$/)
    .withMessage('product_code must not contain spaces'),

  body('season')
    .optional()
    .matches(/^\d{4}\/\d{2}$/)
    .withMessage('season must match format YYYY/YY (e.g., 2024/25)'),

  body('jersey_type')
    .optional()
    .isIn(['home', 'away', 'third', 'goalkeeper'])
    .withMessage('jersey_type must be one of: home, away, third, goalkeeper'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage('name must not exceed 150 characters'),

  body('price_usd')
    .optional()
    .isFloat({ min: 1, max: 999 })
    .withMessage('price_usd must be a number between 1 and 999'),

  body('technology')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('technology must not exceed 50 characters'),

  body('in_stock')
    .optional()
    .isBoolean()
    .withMessage('in_stock must be a boolean'),

  body('release_date')
    .optional()
    .isISO8601()
    .withMessage('release_date must be a valid ISO 8601 date'),
];

/**
 * Middleware to handle validation errors
 * Call this after validation, before route handler
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

export default { validateJerseyCreate, validateJerseyUpdate, handleValidationErrors };
