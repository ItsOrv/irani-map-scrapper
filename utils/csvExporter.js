// CSV exporter with UTF-8 BOM support for Persian characters

/**
 * Convert business data to CSV format with UTF-8 BOM
 * @param {Array} businesses - Array of business objects
 * @returns {string} - CSV string with UTF-8 BOM
 */
function exportToCSV(businesses) {
  if (!businesses || businesses.length === 0) {
    return '';
  }

  // Define CSV headers
  const headers = [
    'نام کسب‌وکار',
    'آدرس',
    'شماره تلفن',
    'ایمیل',
    'وب‌سایت',
    'دسته‌بندی'
  ];

  // Create CSV rows
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

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Add UTF-8 BOM for proper Persian character display
  const BOM = '\uFEFF';
  return BOM + csvContent;
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 * @param {string} field - Field value to escape
 * @returns {string} - Escaped field value
 */
function escapeCSV(field) {
  if (field === null || field === undefined) {
    return '';
  }

  const str = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

/**
 * Download CSV file
 * @param {string} csvContent - CSV content string
 * @param {string} filename - Filename for download
 */
function downloadCSV(csvContent, filename = 'balad-scraped-data.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { exportToCSV, escapeCSV, downloadCSV };
}

