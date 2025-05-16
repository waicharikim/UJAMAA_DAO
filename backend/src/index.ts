import app from './app.js';
import logger from './utils/logger.js'; // Adjust path if needed

const PORT = parseInt(process.env.PORT || '4000', 10);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});