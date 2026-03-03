/**
 * 404 Not Found middleware
 * Catches all requests that don't match any route and returns a JSON response
 */
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
};

export default notFound;
