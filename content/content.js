// Content script for scraping Balad va Neshan website

// Wait for page to be fully loaded
function waitForPageLoad() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
}

// Wait for element to appear
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// Extract data from Next.js __NEXT_DATA__ script tag
function extractDataFromNextJS() {
  const nextDataScript = document.getElementById('__NEXT_DATA__');
  if (nextDataScript) {
    try {
      const data = JSON.parse(nextDataScript.textContent);
      return data;
    } catch (e) {
      console.error('Error parsing __NEXT_DATA__:', e);
    }
  }
  return null;
}

// Extract businesses from Next.js data structure
function extractBusinessesFromData(nextData) {
  const businesses = [];
  
  if (!nextData || !nextData.props || !nextData.props.pageProps) {
    return businesses;
  }

  const pageProps = nextData.props.pageProps;
  
  // Check for widgets data
  if (pageProps.data && pageProps.data.widgets) {
    pageProps.data.widgets.forEach(widget => {
      if (widget.type === 'horizontal_list' && widget.data && widget.data.items) {
        widget.data.items.forEach(item => {
          if (item.name) {
            businesses.push({
              name: item.name || '',
              address: item.centerPoint ? `مختصات: ${item.centerPoint.coordinates.join(', ')}` : '',
              phone: '', // Phone not in this structure - will be filled from detail page
              email: '', // Email not in this structure - will be filled from detail page
              website: item.urlTitle ? `https://balad.ir/${item.urlTitle}` : '',
              category: item.category || '',
              token: item.token || '', // Token for detail page access
              detailUrl: item.token ? `https://balad.ir/poi/${item.token}` : (item.urlTitle ? `https://balad.ir/${item.urlTitle}` : '')
            });
          }
        });
      }
      
      if (widget.type === 'stacked-list' && widget.data && widget.data.items) {
        widget.data.items.forEach(item => {
          if (item.text) {
            businesses.push({
              name: item.text || '',
              address: '',
              phone: '',
              email: '',
              website: item.link && item.link.page ? `https://balad.ir/${item.link.page}` : '',
              category: ''
            });
          }
        });
      }
    });
  }

  return businesses;
}

// Extract business data from DOM (fallback method)
function scrapeCurrentPageFromDOM() {
  const businesses = [];
  
  // Try to find POI items in the DOM
  // Based on the HTML structure, look for elements with specific classes
  const poiSelectors = [
    'a[href*="/poi/"]',
    'a[href*="/maps/"]',
    '[class*="PoiItem"]',
    '[class*="poi-item"]',
    '[class*="business"]',
    '[class*="result"]',
    'li[class*="Item"]'
  ];

  let foundElements = [];
  poiSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (!foundElements.includes(el)) {
        foundElements.push(el);
      }
    });
  });

  foundElements.forEach((card, index) => {
    try {
      const business = {
        name: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        category: ''
      };

      // Extract name - try multiple selectors
      const nameSelectors = [
        'h2', 'h3', 'h4',
        '[class*="name"]',
        '[class*="title"]',
        '[class*="Name"]',
        '[class*="Title"]',
        'a'
      ];
      
      for (const selector of nameSelectors) {
        const nameEl = card.querySelector(selector);
        if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
          business.name = nameEl.textContent.trim();
          break;
        }
      }
      
      // If no name found, try card's own text
      if (!business.name && card.textContent) {
        business.name = card.textContent.trim().split('\n')[0].substring(0, 100);
      }

      // Extract address
      const addressSelectors = [
        '[class*="address"]',
        '[class*="location"]',
        '[class*="Address"]',
        '[class*="Location"]'
      ];
      for (const selector of addressSelectors) {
        const addressEl = card.querySelector(selector);
        if (addressEl && addressEl.textContent) {
          business.address = addressEl.textContent.trim();
          break;
        }
      }

      // Extract phone
      const phoneEl = card.querySelector('a[href^="tel:"]');
      if (phoneEl) {
        business.phone = phoneEl.getAttribute('href')?.replace('tel:', '') || phoneEl.textContent.trim();
      }

      // Extract email
      const emailEl = card.querySelector('a[href^="mailto:"]');
      if (emailEl) {
        business.email = emailEl.getAttribute('href')?.replace('mailto:', '') || emailEl.textContent.trim();
      }

      // Extract website
      const websiteEl = card.querySelector('a[href^="http"]:not([href^="mailto:"]):not([href*="balad.ir"])');
      if (websiteEl) {
        business.website = websiteEl.href;
      } else {
        // Try to get link from card
        const linkEl = card.querySelector('a[href]');
        if (linkEl && linkEl.href && !linkEl.href.includes('balad.ir')) {
          business.website = linkEl.href;
        }
      }

      // Extract category
      const categorySelectors = [
        '[class*="category"]',
        '[class*="type"]',
        '[class*="Category"]',
        '[class*="Type"]'
      ];
      for (const selector of categorySelectors) {
        const categoryEl = card.querySelector(selector);
        if (categoryEl && categoryEl.textContent) {
          business.category = categoryEl.textContent.trim();
          break;
        }
      }

      // Only add if at least name is found
      if (business.name && business.name.length > 0) {
        businesses.push(business);
      }
    } catch (error) {
      console.error('Error scraping business card:', error);
    }
  });

  return businesses;
}

// Main scraping function - tries Next.js data first, then DOM
async function scrapePage() {
  await waitForPageLoad();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for React to render
  
  let businesses = [];
  
  // First, try to extract from Next.js data structure
  const nextData = extractDataFromNextJS();
  if (nextData) {
    businesses = extractBusinessesFromData(nextData);
    console.log(`Extracted ${businesses.length} businesses from Next.js data`);
  }
  
  // If no businesses found, try DOM scraping
  if (businesses.length === 0) {
    businesses = scrapeCurrentPageFromDOM();
    console.log(`Extracted ${businesses.length} businesses from DOM`);
  }
  
  return businesses;
}

// Find and click next page button
async function navigateToNextPage() {
  try {
    // Common selectors for pagination in Balad
    const nextButtonSelectors = [
      'a[aria-label*="بعدی"]',
      'a[aria-label*="next"]',
      'button[aria-label*="بعدی"]',
      'button[aria-label*="next"]',
      '.pagination a:last-child',
      '.pagination button:last-child',
      '[class*="Pagination"] a:last-child',
      '[class*="pagination"] a:last-child',
      'a[href*="page="]',
      'button:contains("بعدی")'
    ];

    for (const selector of nextButtonSelectors) {
      try {
        const nextButton = document.querySelector(selector);
        if (nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled')) {
          // Check if it's actually a next button
          const text = nextButton.textContent || nextButton.getAttribute('aria-label') || '';
          if (text.includes('بعدی') || text.includes('next') || selector.includes('last-child')) {
            nextButton.click();
            // Wait for page to load after navigation
            await new Promise(resolve => setTimeout(resolve, 3000));
            await waitForPageLoad();
            return true;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Try scrolling to load more (infinite scroll)
    const scrollableContainer = document.querySelector('[class*="scrollable"]') || window;
    if (scrollableContainer) {
      scrollableContainer.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true; // Assume more content loaded
    }

    return false;
  } catch (error) {
    console.error('Error navigating to next page:', error);
    return false;
  }
}

// Check if there are more pages
function hasNextPage() {
  // Check for pagination buttons
  const nextButtonSelectors = [
    'a[aria-label*="بعدی"]:not(.disabled)',
    'a[aria-label*="next"]:not(.disabled)',
    'button[aria-label*="بعدی"]:not(.disabled)',
    'button[aria-label*="next"]:not(.disabled)'
  ];

  for (const selector of nextButtonSelectors) {
    const nextButton = document.querySelector(selector);
    if (nextButton && !nextButton.disabled) {
      return true;
    }
  }

  // Check if we can scroll more
  const canScroll = (window.innerHeight + window.scrollY) < document.body.offsetHeight - 100;
  return canScroll;
}

// Scrape business detail page for phone and email
async function scrapeBusinessDetail(detailUrl) {
  try {
    // Store current URL to go back
    const currentUrl = window.location.href;
    
    // Navigate to detail page
    window.location.href = detailUrl;
    
    // Wait for navigation to complete
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (window.location.href !== currentUrl && document.readyState === 'complete') {
          clearInterval(checkInterval);
          setTimeout(resolve, 1000); // Additional wait
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    });
    
    // Wait for page to load
    await waitForPageLoad();
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for React to render (increased to avoid 418)
    
    const detail = {
      phone: '',
      email: '',
      address: ''
    };
    
    // Try to extract from __NEXT_DATA__
    const nextData = extractDataFromNextJS();
    if (nextData) {
      const dataStr = JSON.stringify(nextData);
      
      // Look for phone in data
      const phonePatterns = [
        /"phone"\s*:\s*"([^"]+)"/i,
        /"tel"\s*:\s*"([^"]+)"/i,
        /"telephone"\s*:\s*"([^"]+)"/i
      ];
      for (const pattern of phonePatterns) {
        const match = dataStr.match(pattern);
        if (match && match[1]) {
          detail.phone = match[1];
          break;
        }
      }
      
      // Look for email in data
      const emailPatterns = [
        /"email"\s*:\s*"([^"]+)"/i,
        /"mail"\s*:\s*"([^"]+)"/i
      ];
      for (const pattern of emailPatterns) {
        const match = dataStr.match(pattern);
        if (match && match[1]) {
          detail.email = match[1];
          break;
        }
      }
    }
    
    // Extract from DOM (fallback)
    if (!detail.phone) {
      const phoneEl = document.querySelector('a[href^="tel:"]');
      if (phoneEl) {
        detail.phone = phoneEl.getAttribute('href')?.replace('tel:', '') || phoneEl.textContent.trim();
      }
    }
    
    if (!detail.email) {
      const emailEl = document.querySelector('a[href^="mailto:"]');
      if (emailEl) {
        detail.email = emailEl.getAttribute('href')?.replace('mailto:', '') || emailEl.textContent.trim();
      }
    }
    
    // Extract address from DOM
    const addressSelectors = [
      '[class*="address"]',
      '[class*="Address"]',
      '[class*="location"]',
      '[class*="Location"]',
      '[class*="addressText"]'
    ];
    for (const selector of addressSelectors) {
      const addressEl = document.querySelector(selector);
      if (addressEl && addressEl.textContent && addressEl.textContent.trim().length > 10) {
        detail.address = addressEl.textContent.trim();
        break;
      }
    }
    
    return detail;
  } catch (error) {
    console.error('Error scraping business detail:', error);
    return { phone: '', email: '', address: '' };
  }
}

// Fetch business detail page HTML without navigation
async function fetchBusinessDetailHTML(detailUrl) {
  try {
    // Try fetch with proper error handling and retry
    let lastError = null;
    
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(detailUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fa,en-US;q=0.9,en;q=0.8',
          },
          credentials: 'include',
          cache: 'no-cache',
          mode: 'cors' // Explicitly set CORS mode
        });
        
        if (!response.ok) {
          // If 418 or other errors, return null to skip
          if (response.status === 418) {
            console.warn('HTTP 418 error for:', detailUrl);
            return null;
          }
          if (response.status >= 400 && response.status < 500) {
            // Client errors - don't retry
            return null;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        if (html && html.length > 100) {
          return html; // Success
        }
      } catch (error) {
        lastError = error;
        
        // CORS or network errors - try once more
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.warn(`CORS/network error (attempt ${attempt + 1}/2) for:`, detailUrl);
          if (attempt < 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
            continue;
          }
        }
        
        // Other errors - return null
        if (attempt === 1) {
          console.error('Error fetching detail page after retries:', error);
          return null;
        }
      }
    }
    
    return null; // All attempts failed
  } catch (error) {
    console.error('Unexpected error fetching detail page:', error);
    return null;
  }
}

// Extract contact info from HTML string
function extractContactInfoFromHTML(html) {
  const detail = {
    phone: '',
    email: '',
    address: ''
  };
  
  if (!html) return detail;
  
  // Create a temporary DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract phone
  const phoneEl = doc.querySelector('a[href^="tel:"]');
  if (phoneEl) {
    detail.phone = phoneEl.getAttribute('href')?.replace('tel:', '') || phoneEl.textContent.trim();
  }
  
  // Extract email
  const emailEl = doc.querySelector('a[href^="mailto:"]');
  if (emailEl) {
    detail.email = emailEl.getAttribute('href')?.replace('mailto:', '') || emailEl.textContent.trim();
  }
  
  // Extract address
  const addressSelectors = [
    '[class*="address"]',
    '[class*="Address"]',
    '[class*="location"]',
    '[class*="Location"]',
    '[class*="addressText"]'
  ];
  for (const selector of addressSelectors) {
    const addressEl = doc.querySelector(selector);
    if (addressEl && addressEl.textContent && addressEl.textContent.trim().length > 10) {
      detail.address = addressEl.textContent.trim();
      break;
    }
  }
  
  // Try to extract from __NEXT_DATA__ in HTML
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const dataStr = JSON.stringify(nextData);
      
      // Look for phone
      if (!detail.phone) {
        const phonePatterns = [
          /"phone"\s*:\s*"([^"]+)"/i,
          /"tel"\s*:\s*"([^"]+)"/i,
          /"telephone"\s*:\s*"([^"]+)"/i
        ];
        for (const pattern of phonePatterns) {
          const match = dataStr.match(pattern);
          if (match && match[1]) {
            detail.phone = match[1];
            break;
          }
        }
      }
      
      // Look for email
      if (!detail.email) {
        const emailPatterns = [
          /"email"\s*:\s*"([^"]+)"/i,
          /"mail"\s*:\s*"([^"]+)"/i
        ];
        for (const pattern of emailPatterns) {
          const match = dataStr.match(pattern);
          if (match && match[1]) {
            detail.email = match[1];
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error parsing __NEXT_DATA__:', e);
    }
  }
  
  return detail;
}

// Navigate to business detail page and extract contact info (using fetch instead of navigation)
async function getBusinessDetailInfo(business) {
  if (!business.detailUrl) {
    return { phone: '', email: '', address: '' };
  }
  
  try {
    // Fetch HTML without navigating
    const html = await fetchBusinessDetailHTML(business.detailUrl);
    
    if (!html) {
      return { phone: '', email: '', address: '' };
    }
    
    // Extract contact info from HTML
    const detailInfo = extractContactInfoFromHTML(html);
    
    return detailInfo;
  } catch (error) {
    console.error('Error getting business detail:', error);
    return { phone: '', email: '', address: '' };
  }
}

// Download CSV helper - uses blob URL in page context (most reliable)
function downloadCSV(csvContent, filename) {
  const startTime = Date.now();
  const runId = 'content-' + Date.now();
  console.log('[CONTENT-DOWNLOAD] Starting content script download...', runId);
  
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:610',message:'downloadCSV function entered',data:{runId:runId,csvSize:csvContent?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW1'})}).catch(e=>console.warn('Log fetch failed:',e));
  } catch(e) {}
  // #endregion
  
  try {
    const csvSize = csvContent ? csvContent.length : 0;
    console.log('[CONTENT-DOWNLOAD] Received:', {
      csvSize: csvSize,
      csvSizeKB: (csvSize / 1024).toFixed(2) + ' KB',
      filename: filename
    });
    
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:625',message:'Before blob creation',data:{runId:runId,csvSize:csvSize},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW2'})}).catch(e=>console.warn('Log fetch failed:',e));
    } catch(e) {}
    // #endregion
    
    if (!csvContent) {
      console.error('[CONTENT-DOWNLOAD] ❌ No CSV content provided');
      throw new Error('No CSV content provided');
    }
    
    // Create blob in page context
    console.log('[CONTENT-DOWNLOAD] Step 1: Creating blob...');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    console.log('[CONTENT-DOWNLOAD] Blob created:', { 
      size: blob.size, 
      type: blob.type 
    });
    
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:638',message:'Blob created',data:{runId:runId,blobSize:blob.size},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW3'})}).catch(e=>console.warn('Log fetch failed:',e));
    } catch(e) {}
    // #endregion
    
    const url = URL.createObjectURL(blob);
    console.log('[CONTENT-DOWNLOAD] Blob URL created:', url);
    
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:643',message:'Blob URL created',data:{runId:runId,url:url.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW4'})}).catch(e=>console.warn('Log fetch failed:',e));
    } catch(e) {}
    // #endregion
    
    // Create download link
    console.log('[CONTENT-DOWNLOAD] Step 2: Creating download link...');
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    console.log('[CONTENT-DOWNLOAD] Link created:', { 
      href: link.href, 
      download: link.download 
    });
    
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:653',message:'Link created, before appendChild',data:{runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW5'})}).catch(e=>console.warn('Log fetch failed:',e));
    } catch(e) {}
    // #endregion
    
    // Append to body
    console.log('[CONTENT-DOWNLOAD] Step 3: Appending link to body...');
    document.body.appendChild(link);
    console.log('[CONTENT-DOWNLOAD] Link appended to body');
    
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:661',message:'Link appended, before click',data:{runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW6'})}).catch(e=>console.warn('Log fetch failed:',e));
    } catch(e) {}
    // #endregion
    
    // Trigger download with error handling
    console.log('[CONTENT-DOWNLOAD] Step 4: Clicking link...');
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        link.click();
        console.log('[CONTENT-DOWNLOAD] ✅ Link clicked successfully');
        
        // #region agent log
        try {
          fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:669',message:'Link clicked successfully',data:{runId:runId,elapsed:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW7'})}).catch(e=>console.warn('Log fetch failed:',e));
        } catch(e) {}
        // #endregion
        
        // Remove link from DOM immediately after click to prevent memory issues
        // But keep blob URL alive for download
        setTimeout(() => {
          try {
            if (document.body.contains(link)) {
              document.body.removeChild(link);
              console.log('[CONTENT-DOWNLOAD] Link removed from DOM');
            }
          } catch (e) {
            console.warn('[CONTENT-DOWNLOAD] Error removing link:', e);
          }
        }, 100);
        
        // Revoke blob URL after download starts (with delay)
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
            console.log('[CONTENT-DOWNLOAD] Blob URL revoked');
            
            // #region agent log
            try {
              fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:690',message:'Blob URL revoked (1s after click)',data:{runId:runId,elapsed:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW8'})}).catch(e=>console.warn('Log fetch failed:',e));
            } catch(e) {}
            // #endregion
          } catch (e) {
            console.warn('[CONTENT-DOWNLOAD] Error revoking blob URL:', e);
          }
        }, 1000); // 1 second delay - enough for download to start
        
        // Monitor for crash after click
        setTimeout(() => {
          // #region agent log
          try {
            fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:700',message:'Post-click check (3s after)',data:{runId:runId,elapsed:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW9'})}).catch(e=>console.warn('Log fetch failed:',e));
          } catch(e) {}
          // #endregion
        }, 3000);
      } catch (e) {
        console.error('[CONTENT-DOWNLOAD] ❌ Error clicking link:', e);
        throw e;
      }
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('[CONTENT-DOWNLOAD] ❌ Exception caught after', elapsed + 'ms:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:690',message:'Exception in downloadCSV',data:{runId:runId,error:error.message,elapsed:elapsed},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW9'})}).catch(e=>console.warn('Log fetch failed:',e));
    } catch(e) {}
    // #endregion
    
    throw error;
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'scrape-page') {
    scrapePage().then(businesses => {
      sendResponse({ success: true, businesses: businesses });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (message.type === 'scrape-detail') {
    // Scrape detail page for a specific business
    // Use a timeout to ensure response is sent even if there's an error
    const timeout = setTimeout(() => {
      sendResponse({ success: false, detail: { phone: '', email: '', address: '' }, error: 'Timeout' });
    }, 15000); // 15 second timeout
    
    getBusinessDetailInfo(message.business).then(detailInfo => {
      clearTimeout(timeout);
      sendResponse({ success: true, detail: detailInfo });
    }).catch(error => {
      clearTimeout(timeout);
      console.error('Error in getBusinessDetailInfo:', error);
      sendResponse({ success: false, detail: { phone: '', email: '', address: '' }, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (message.type === 'navigate-next') {
    navigateToNextPage().then(hasNext => {
      sendResponse({ success: true, hasNext: hasNext });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.type === 'check-next-page') {
    const hasNext = hasNextPage();
    sendResponse({ success: true, hasNext: hasNext });
    return true;
  } else if (message.type === 'download-csv') {
    downloadCSV(message.csvContent, message.filename);
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'download-csv-file') {
    // Download CSV file from content script (primary method - most reliable)
    const runId = 'run-' + Date.now();
    console.log('[CONTENT] Received download-csv-file message:', {
      hasContent: !!message.csvContent,
      contentSize: message.csvContent ? message.csvContent.length : 0,
      filename: message.filename
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:686',message:'Content script download handler entered',data:{hasContent:!!message.csvContent,contentSize:message.csvContent?.length||0,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX4'})}).catch(()=>{});
    // #endregion
    
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:692',message:'Before downloadCSV call',data:{runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX5'})}).catch(()=>{});
      // #endregion
      
      downloadCSV(message.csvContent, message.filename);
      console.log('[CONTENT] ✅ Download completed successfully');
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:697',message:'downloadCSV completed, sending response',data:{runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX6'})}).catch(()=>{});
      // #endregion
      
      sendResponse({ success: true });
      
      // Monitor for crash after download
      setTimeout(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:704',message:'Post-download check (3s after)',data:{runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX7'})}).catch(()=>{});
        // #endregion
      }, 3000);
    } catch (error) {
      console.error('[CONTENT] ❌ Error downloading CSV:', {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:714',message:'Exception in content download',data:{error:error.message,stack:error.stack,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX8'})}).catch(()=>{});
      // #endregion
      
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});
