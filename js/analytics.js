/**
 * Vercel Web Analytics Integration
 * This module initializes Vercel Web Analytics for the Abyssal Rush game
 */

// Import the inject function from @vercel/analytics
import { inject } from '../public/analytics.mjs';

// Initialize analytics
inject({
  debug: false // Set to true for development debugging
});
