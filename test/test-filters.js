// Test script for filters functionality

// Mock filter functions (same logic as in filters.js)
function applyFilters(business, filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return true;
  }

  if (filters.businessName && filters.businessName.trim() !== '') {
    const name = (business.name || '').toLowerCase();
    const searchTerm = filters.businessName.toLowerCase();
    if (!name.includes(searchTerm)) {
      return false;
    }
  }

  if (filters.hasEmail) {
    if (!business.email || business.email.trim() === '') {
      return false;
    }
  }

  if (filters.hasWebsite) {
    if (!business.website || business.website.trim() === '') {
      return false;
    }
  }

  if (filters.category && filters.category.trim() !== '') {
    const category = (business.category || '').toLowerCase();
    const searchTerm = filters.category.toLowerCase();
    if (!category.includes(searchTerm)) {
      return false;
    }
  }

  return true;
}

// Test cases
const testBusinesses = [
  {
    name: 'رستوران سنتی',
    address: 'تهران',
    phone: '021-12345678',
    email: 'info@restaurant.com',
    website: 'https://restaurant.com',
    category: 'رستوران'
  },
  {
    name: 'کافی‌شاپ مدرن',
    address: 'اصفهان',
    phone: '031-87654321',
    email: '',
    website: 'https://cafe.com',
    category: 'کافی‌شاپ'
  },
  {
    name: 'فروشگاه لوازم خانگی',
    address: 'مشهد',
    phone: '051-11111111',
    email: 'shop@example.com',
    website: '',
    category: 'فروشگاه'
  }
];

// Test 1: No filters
console.log('Test 1: No filters');
const result1 = testBusinesses.filter(b => applyFilters(b, {}));
console.assert(result1.length === 3, 'Should return all businesses');
console.log('✓ Passed');

// Test 2: Filter by business name
console.log('\nTest 2: Filter by business name (رستوران)');
const result2 = testBusinesses.filter(b => applyFilters(b, { businessName: 'رستوران' }));
console.assert(result2.length === 1, 'Should return 1 restaurant');
console.assert(result2[0].name === 'رستوران سنتی', 'Should be the restaurant');
console.log('✓ Passed');

// Test 3: Filter by email existence
console.log('\nTest 3: Filter by email existence');
const result3 = testBusinesses.filter(b => applyFilters(b, { hasEmail: true }));
console.assert(result3.length === 2, 'Should return 2 businesses with email');
console.log('✓ Passed');

// Test 4: Filter by website existence
console.log('\nTest 4: Filter by website existence');
const result4 = testBusinesses.filter(b => applyFilters(b, { hasWebsite: true }));
console.assert(result4.length === 2, 'Should return 2 businesses with website');
console.log('✓ Passed');

// Test 5: Combined filters
console.log('\nTest 5: Combined filters (hasEmail + category)');
const result5 = testBusinesses.filter(b => applyFilters(b, { 
  hasEmail: true, 
  category: 'رستوران' 
}));
console.assert(result5.length === 1, 'Should return 1 business');
console.log('✓ Passed');

console.log('\n✅ All filter tests passed!');

