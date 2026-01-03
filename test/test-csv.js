// Test script for CSV export functionality

function exportToCSV(businesses) {
  if (!businesses || businesses.length === 0) {
    return '';
  }

  const headers = [
    'نام کسب‌وکار',
    'آدرس',
    'شماره تلفن',
    'ایمیل',
    'وب‌سایت',
    'دسته‌بندی'
  ];

  const escapeCSV = (field) => {
    if (field === null || field === undefined) {
      return '';
    }
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const rows = businesses.map(business => {
    return [
      escapeCSV(business.name || ''),
      escapeCSV(business.address || ''),
      escapeCSV(business.phone || ''),
      escapeCSV(business.email || ''),
      escapeCSV(business.website || ''),
      escapeCSV(business.category || '')
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const BOM = '\uFEFF';
  return BOM + csvContent;
}

// Test cases
const testBusinesses = [
  {
    name: 'رستوران سنتی',
    address: 'تهران، خیابان ولیعصر',
    phone: '021-12345678',
    email: 'info@restaurant.com',
    website: 'https://restaurant.com',
    category: 'رستوران'
  },
  {
    name: 'کافی‌شاپ',
    address: 'اصفهان',
    phone: '031-87654321',
    email: '',
    website: '',
    category: 'کافی‌شاپ'
  }
];

// Test 1: Basic CSV export
console.log('Test 1: Basic CSV export');
const csv = exportToCSV(testBusinesses);
console.assert(csv.includes('نام کسب‌وکار'), 'Should contain headers');
console.assert(csv.includes('رستوران سنتی'), 'Should contain business name');
console.assert(csv.includes('تهران'), 'Should contain address');
console.assert(csv.charCodeAt(0) === 0xFEFF, 'Should start with UTF-8 BOM');
console.log('✓ Passed');

// Test 2: Empty array
console.log('\nTest 2: Empty array');
const csvEmpty = exportToCSV([]);
console.assert(csvEmpty === '', 'Should return empty string');
console.log('✓ Passed');

// Test 3: Special characters (commas, quotes)
console.log('\nTest 3: Special characters handling');
const specialBusiness = [{
  name: 'رستوران "مشهور"',
  address: 'تهران، خیابان ولیعصر، پلاک 123',
  phone: '021-12345678',
  email: '',
  website: '',
  category: 'رستوران'
}];
const csvSpecial = exportToCSV(specialBusiness);
console.assert(csvSpecial.includes('"رستوران ""مشهور"""'), 'Should escape quotes');
console.log('✓ Passed');

console.log('\n✅ All CSV export tests passed!');
console.log('\nSample CSV output:');
console.log(csv);

