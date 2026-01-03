// Background service worker for managing scraping process

let scrapingState = {
  isScraping: false,
  shouldStop: false,
  count: 0,
  filters: null
};

// Load filters utility (inline since we can't import in service worker)
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

// CSV export function
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

// Main scraping loop
async function startScraping(tabId, filters, scrapeDetails = true) {
  scrapingState.isScraping = true;
  scrapingState.shouldStop = false;
  scrapingState.count = 0;
  scrapingState.filters = filters;
  scrapingState.scrapeDetails = scrapeDetails;

  let allBusinesses = [];
  let pageCount = 0;
  const maxPages = 1000; // Safety limit

  try {
    // Save initial state
    await chrome.storage.local.set({ scrapingState });

    while (scrapingState.isScraping && !scrapingState.shouldStop && pageCount < maxPages) {
      // Scrape current page
      const scrapeResult = await chrome.tabs.sendMessage(tabId, { type: 'scrape-page' });
      
      if (!scrapeResult || !scrapeResult.success) {
        throw new Error(scrapeResult?.error || 'Failed to scrape page');
      }

      const businesses = scrapeResult.businesses || [];

      // Apply filters
      let filteredBusinesses = businesses.filter(business => 
        applyFilters(business, filters)
      );

      // Enrich businesses with detail page data (phone, email, full address)
      // Only if detailUrl is available and scrapeDetails is enabled
      if (scrapingState.scrapeDetails) {
        for (let i = 0; i < filteredBusinesses.length; i++) {
          const business = filteredBusinesses[i];
          if (business.detailUrl && !scrapingState.shouldStop) {
            try {
              // Use executeScript to run fetch in page context (avoids CORS)
              let detailResult = null;
              
              try {
                // Check if tab still exists and is accessible
                const tab = await chrome.tabs.get(tabId);
                if (!tab || !tab.url || !tab.url.includes('balad.ir')) {
                  console.warn('Tab is not accessible, skipping detail');
                  continue;
                }
                
                // Execute fetch in page context using executeScript
                const results = await chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  func: async (detailUrl) => {
                    try {
                      const response = await fetch(detailUrl, {
                        method: 'GET',
                        headers: {
                          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                          'Accept-Language': 'fa,en-US;q=0.9,en;q=0.8',
                        },
                        credentials: 'include',
                        cache: 'no-cache'
                      });
                      
                      if (!response.ok) {
                        if (response.status === 418) {
                          return { error: 'HTTP 418' };
                        }
                        return { error: `HTTP ${response.status}` };
                      }
                      
                      const html = await response.text();
                      
                      // Extract contact info from HTML
                      const detail = { phone: '', email: '', address: '' };
                      
                      // Parse HTML
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
                        '[class*="Location"]'
                      ];
                      for (const selector of addressSelectors) {
                        const addressEl = doc.querySelector(selector);
                        if (addressEl && addressEl.textContent && addressEl.textContent.trim().length > 10) {
                          detail.address = addressEl.textContent.trim();
                          break;
                        }
                      }
                      
                      // Try to extract from __NEXT_DATA__
                      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
                      if (nextDataMatch) {
                        try {
                          const nextData = JSON.parse(nextDataMatch[1]);
                          const dataStr = JSON.stringify(nextData);
                          
                          // Look for phone
                          if (!detail.phone) {
                            const phoneMatch = dataStr.match(/"phone"\s*:\s*"([^"]+)"/i) ||
                                              dataStr.match(/"tel"\s*:\s*"([^"]+)"/i);
                            if (phoneMatch) {
                              detail.phone = phoneMatch[1];
                            }
                          }
                          
                          // Look for email
                          if (!detail.email) {
                            const emailMatch = dataStr.match(/"email"\s*:\s*"([^"]+)"/i);
                            if (emailMatch) {
                              detail.email = emailMatch[1];
                            }
                          }
                        } catch (e) {
                          // Ignore parse errors
                        }
                      }
                      
                      return { success: true, detail: detail };
                    } catch (error) {
                      return { error: error.message };
                    }
                  },
                  args: [business.detailUrl]
                });
                
                if (results && results[0] && results[0].result) {
                  detailResult = results[0].result;
                }
              } catch (error) {
                console.warn('Error executing script for detail:', error.message);
                // Continue with next business
              }
              
              if (detailResult && detailResult.success && detailResult.detail) {
                // Update business with detail info
                if (detailResult.detail.phone) {
                  business.phone = detailResult.detail.phone;
                }
                if (detailResult.detail.email) {
                  business.email = detailResult.detail.email;
                }
                if (detailResult.detail.address && detailResult.detail.address.length > 10) {
                  business.address = detailResult.detail.address;
                }
              }
              
              // Rate limiting between detail page requests (increased to avoid 418 error)
              await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (error) {
              console.error('Error scraping detail for business:', business.name, error);
              // Continue with next business even if detail scraping fails
            }
          }
        }
      }

      // Add to collection
      allBusinesses = allBusinesses.concat(filteredBusinesses);
      scrapingState.count = allBusinesses.length;

      // Update progress
      await chrome.storage.local.set({ scrapingState });
      chrome.runtime.sendMessage({
        type: 'scraping-progress',
        count: scrapingState.count
      }).catch(() => {}); // Ignore errors if popup is closed

      // Check if there's a next page
      const nextCheck = await chrome.tabs.sendMessage(tabId, { type: 'check-next-page' });
      
      if (!nextCheck || !nextCheck.hasNext) {
        break; // No more pages
      }

      // Navigate to next page
      const navResult = await chrome.tabs.sendMessage(tabId, { type: 'navigate-next' });
      
      if (!navResult || !navResult.success || !navResult.hasNext) {
        break; // Failed to navigate or no more pages
      }

      pageCount++;
      
      // Rate limiting - wait between pages (increased to avoid 418 error)
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    // Save final data
    await chrome.storage.local.set({ 
      scrapedData: allBusinesses,
      scrapingState: { ...scrapingState, isScraping: false }
    });

    scrapingState.isScraping = false;

    // Notify completion
    chrome.runtime.sendMessage({
      type: 'scraping-complete',
      count: allBusinesses.length
    }).catch(() => {});

  } catch (error) {
    scrapingState.isScraping = false;
    await chrome.storage.local.set({ scrapingState });
    
    chrome.runtime.sendMessage({
      type: 'scraping-error',
      error: error.message
    }).catch(() => {});

    // Save what we have so far
    if (allBusinesses.length > 0) {
      await chrome.storage.local.set({ scrapedData: allBusinesses });
    }
  }
}

// Stop scraping
function stopScraping() {
  scrapingState.shouldStop = true;
  scrapingState.isScraping = false;
  chrome.storage.local.set({ scrapingState });
  
  chrome.runtime.sendMessage({
    type: 'scraping-stopped'
  }).catch(() => {});
}

// Fetch business detail page HTML
async function fetchBusinessDetailHTML(detailUrl) {
  try {
    // Use chrome.tabs.create to fetch the page
    // Or use fetch from background (may have CORS issues)
    // Best approach: use chrome.tabs.executeScript to fetch in content context
    
    // Try fetch first (may work if same origin)
    try {
      const response = await fetch(detailUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fa,en-US;q=0.9,en;q=0.8',
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const html = await response.text();
        return html;
      }
    } catch (fetchError) {
      console.log('Fetch failed, trying alternative method:', fetchError);
    }
    
    // Alternative: return null and let content script handle it
    return null;
  } catch (error) {
    console.error('Error fetching detail page:', error);
    return null;
  }
}

// Download CSV
async function downloadCSV() {
  try {
    const result = await chrome.storage.local.get(['scrapedData']);
    const businesses = result.scrapedData || [];

    if (businesses.length === 0) {
      throw new Error('هیچ داده‌ای برای دانلود وجود ندارد');
    }

    const csvContent = exportToCSV(businesses);
    const filename = `balad-scraped-data-${Date.now()}.csv`;
    
    // Convert to data URL (works in service worker)
    const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    
    // Use chrome.downloads API
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve({ success: true, downloadId: downloadId });
        }
      });
    });
  } catch (error) {
    console.error('Error in downloadCSV:', error);
    throw error;
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'start-scraping') {
    const { location, filters, scrapeDetails = true, tabId } = message;
    startScraping(tabId, filters, scrapeDetails).catch(error => {
      chrome.runtime.sendMessage({
        type: 'scraping-error',
        error: error.message
      }).catch(() => {});
    });
    sendResponse({ success: true });
  } else if (message.type === 'stop-scraping') {
    stopScraping();
    sendResponse({ success: true });
  } else if (message.type === 'download-csv') {
    downloadCSV().then((result) => {
      sendResponse({ success: true, ...result });
    }).catch(error => {
      console.error('Download CSV error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (message.type === 'download-csv-blob') {
    // Download CSV using blob URL from popup
    try {
      chrome.downloads.download({
        url: message.blobUrl,
        filename: message.filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId: downloadId });
        }
      });
    } catch (error) {
      console.error('Download blob error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep channel open for async response
  } else if (message.type === 'download-csv-content') {
    // Download CSV using content from popup - use chrome.downloads API directly
    // This is the most stable method - no executeScript, no blob URLs in popup
    const startTime = Date.now();
    const runId = 'run-' + Date.now();
    console.log('[BACKGROUND-DOWNLOAD] Starting download process...');
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:455',message:'Background download handler entered',data:{runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    try {
      const csvContent = message.csvContent;
      const filename = message.filename || `balad-scraped-data-${Date.now()}.csv`;
      const csvSize = csvContent ? csvContent.length : 0;
      const csvSizeKB = csvSize / 1024;
      
      console.log('[BACKGROUND-DOWNLOAD] Received request:', {
        csvSize: csvSize,
        csvSizeKB: csvSizeKB.toFixed(2) + ' KB',
        filename: filename,
        firstChars: csvContent ? csvContent.substring(0, 100) : 'null'
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:468',message:'CSV content received in background',data:{csvSize:csvSize,csvSizeKB:csvSizeKB.toFixed(2),runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (!csvContent) {
        console.error('[BACKGROUND-DOWNLOAD] ❌ No CSV content provided');
        sendResponse({ success: false, error: 'No CSV content provided' });
        return true;
      }
      
      // Use data URL with chrome.downloads API
      // This works in service worker context and is the most stable method
      console.log('[BACKGROUND-DOWNLOAD] Step 1: Creating data URL...');
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:480',message:'Before encodeURIComponent',data:{csvSize:csvSize,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      const dataUrlSize = dataUrl.length;
      const dataUrlSizeKB = dataUrlSize / 1024;
      console.log('[BACKGROUND-DOWNLOAD] Data URL created:', {
        size: dataUrlSize,
        sizeKB: dataUrlSizeKB.toFixed(2) + ' KB',
        firstChars: dataUrl.substring(0, 150)
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:488',message:'Data URL created',data:{dataUrlSize:dataUrlSize,dataUrlSizeKB:dataUrlSizeKB.toFixed(2),runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      console.log('[BACKGROUND-DOWNLOAD] Step 2: Calling chrome.downloads.download...');
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:492',message:'Before chrome.downloads.download',data:{dataUrlSize:dataUrlSize,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        const elapsed = Date.now() - startTime;
        console.log('[BACKGROUND-DOWNLOAD] Download callback called after', elapsed + 'ms:', {
          downloadId: downloadId,
          lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : null
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:500',message:'Download callback executed',data:{elapsed:elapsed,downloadId:downloadId,hasError:!!chrome.runtime.lastError,error:chrome.runtime.lastError?.message,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        if (chrome.runtime.lastError) {
          console.error('[BACKGROUND-DOWNLOAD] ❌ Download error:', {
            error: chrome.runtime.lastError.message,
            errorCode: chrome.runtime.lastError,
            elapsed: elapsed + 'ms'
          });
          
          // If data URL fails (e.g., file too large), try content script method
          console.log('[BACKGROUND-DOWNLOAD] Step 3: Trying content script fallback...');
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            console.log('[BACKGROUND-DOWNLOAD] Tabs query result:', {
              tabsFound: tabs ? tabs.length : 0,
              firstTab: tabs && tabs[0] ? {
                id: tabs[0].id,
                url: tabs[0].url,
                isHttp: tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))
              } : null
            });
            
            if (tabs[0] && tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
              // Try content script as fallback
              console.log('[BACKGROUND-DOWNLOAD] Sending message to content script...');
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'download-csv-file',
                csvContent: csvContent,
                filename: filename
              }, (response) => {
                console.log('[BACKGROUND-DOWNLOAD] Content script response:', {
                  response: response,
                  lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : null
                });
                
                if (chrome.runtime.lastError) {
                  console.error('[BACKGROUND-DOWNLOAD] ❌ Content script error:', chrome.runtime.lastError.message);
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  sendResponse({ success: response && response.success || false });
                }
              });
            } else {
              console.error('[BACKGROUND-DOWNLOAD] ❌ No suitable tab found');
              sendResponse({ success: false, error: 'No suitable tab for download' });
            }
          });
        } else {
          console.log('[BACKGROUND-DOWNLOAD] ✅ Download successful!', {
            downloadId: downloadId,
            elapsed: elapsed + 'ms'
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:540',message:'Download reported successful, before sendResponse',data:{elapsed:elapsed,downloadId:downloadId,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
          // #endregion
          
          sendResponse({ success: true, downloadId: downloadId });
          
          // Monitor service worker after response
          setTimeout(() => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:548',message:'Post-download check (3s after callback)',data:{elapsed:Date.now()-startTime,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H'})}).catch(()=>{});
            // #endregion
          }, 3000);
        }
      });
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('[BACKGROUND-DOWNLOAD] ❌ Exception caught after', elapsed + 'ms:', {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:560',message:'Exception in background download',data:{error:error.message,stack:error.stack,name:error.name,elapsed:elapsed,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep channel open for async response
  }
});

// Load state on startup
chrome.storage.local.get(['scrapingState'], (result) => {
  if (result.scrapingState) {
    scrapingState = { ...scrapingState, ...result.scrapingState };
  }
});

