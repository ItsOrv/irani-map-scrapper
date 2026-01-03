// Filter system for scraped business data

/**
 * Apply filters to a business data object
 * @param {Object} business - Business data object
 * @param {Object} filters - Filter criteria
 * @returns {boolean} - True if business matches filters
 */
function applyFilters(business, filters) {
  // Filter by business name (text search)
  if (filters.businessName && filters.businessName.trim() !== '') {
    const name = (business.name || '').toLowerCase();
    const searchTerm = filters.businessName.toLowerCase();
    if (!name.includes(searchTerm)) {
      return false;
    }
  }

  // Filter by email existence
  if (filters.hasEmail) {
    if (!business.email || business.email.trim() === '') {
      return false;
    }
  }

  // Filter by website existence
  if (filters.hasWebsite) {
    if (!business.website || business.website.trim() === '') {
      return false;
    }
  }

  // Filter by category
  if (filters.category && filters.category.trim() !== '') {
    const category = (business.category || '').toLowerCase();
    const searchTerm = filters.category.toLowerCase();
    if (!category.includes(searchTerm)) {
      return false;
    }
  }

  return true;
}

/**
 * Filter an array of businesses
 * @param {Array} businesses - Array of business objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} - Filtered array of businesses
 */
function filterBusinesses(businesses, filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return businesses;
  }

  return businesses.filter(business => applyFilters(business, filters));
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { applyFilters, filterBusinesses };
}

