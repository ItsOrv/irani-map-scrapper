// Popup script for Balad va Neshan scraper

let isScraping = false;

// DOM elements
const locationInput = document.getElementById('location');
const businessNameInput = document.getElementById('businessName');
const hasEmailCheckbox = document.getElementById('hasEmail');
const hasWebsiteCheckbox = document.getElementById('hasWebsite');
const categoryInput = document.getElementById('category');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressSection = document.getElementById('progressSection');
const progressText = document.getElementById('progressText');
const progressCount = document.getElementById('progressCount');
const progressFill = document.getElementById('progressFill');
const statusMessage = document.getElementById('statusMessage');

// Load saved state
chrome.storage.local.get(['scrapingState', 'scrapedData'], (result) => {
  if (result.scrapingState && result.scrapingState.isScraping) {
    isScraping = true;
    updateUIForScraping(true);
    updateProgress(result.scrapingState.count || 0);
  }
  
  if (result.scrapedData && result.scrapedData.length > 0) {
    downloadBtn.style.display = 'inline-block';
  }
});

// Listen for progress updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'scraping-progress') {
    updateProgress(message.count);
  } else if (message.type === 'scraping-complete') {
    isScraping = false;
    updateUIForScraping(false);
    showStatus('اسکرپینگ با موفقیت انجام شد!', 'success');
    downloadBtn.style.display = 'inline-block';
  } else if (message.type === 'scraping-error') {
    isScraping = false;
    updateUIForScraping(false);
    showStatus('خطا: ' + message.error, 'error');
  } else if (message.type === 'scraping-stopped') {
    isScraping = false;
    updateUIForScraping(false);
    showStatus('اسکرپینگ متوقف شد.', 'info');
  }
});

// Start scraping
startBtn.addEventListener('click', async () => {
  const location = locationInput.value.trim();
  
  if (!location) {
    showStatus('لطفاً شهر یا استان را وارد کنید.', 'error');
    return;
  }

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url || !tab.url.includes('balad.ir')) {
    showStatus('لطفاً ابتدا به سایت balad.ir بروید و جستجوی مورد نظر را انجام دهید.', 'error');
    return;
  }

  const filters = {
    businessName: businessNameInput.value.trim(),
    hasEmail: hasEmailCheckbox.checked,
    hasWebsite: hasWebsiteCheckbox.checked,
    category: categoryInput.value.trim()
  };

  const scrapeDetails = document.getElementById('scrapeDetails').checked;

  // Send message to background script
  chrome.runtime.sendMessage({
    type: 'start-scraping',
    location: location,
    filters: filters,
    scrapeDetails: scrapeDetails,
    tabId: tab.id
  });

  isScraping = true;
  updateUIForScraping(true);
  showStatus('در حال شروع اسکرپینگ...', 'info');
});

// Stop scraping
stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'stop-scraping' });
  isScraping = false;
  updateUIForScraping(false);
});

// Download CSV - Using chrome.downloads API directly (most stable, no executeScript needed)
downloadBtn.addEventListener('click', async () => {
  const startTime = Date.now();
  const runId = 'run-' + Date.now();
  console.log('[DOWNLOAD] Starting download process...');
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:101',message:'Download button clicked',data:{runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  try {
    showStatus('در حال آماده‌سازی فایل CSV...', 'info');
    console.log('[DOWNLOAD] Step 1: Preparing CSV...');
    
    // Check if data exists
    console.log('[DOWNLOAD] Step 2: Checking storage for scrapedData...');
    const result = await chrome.storage.local.get(['scrapedData']);
    const dataSize = result.scrapedData ? result.scrapedData.length : 0;
    console.log('[DOWNLOAD] Storage result:', { 
      hasData: !!result.scrapedData, 
      dataLength: dataSize
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:115',message:'Storage data retrieved',data:{hasData:!!result.scrapedData,dataLength:dataSize,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (!result.scrapedData || result.scrapedData.length === 0) {
      console.warn('[DOWNLOAD] No data found in storage');
      showStatus('هیچ داده‌ای برای دانلود وجود ندارد. لطفاً ابتدا اسکرپینگ را انجام دهید.', 'error');
      return;
    }
    
    // Generate CSV content
    console.log('[DOWNLOAD] Step 3: Generating CSV content...');
    const csvContent = generateCSVContent(result.scrapedData);
    const csvSize = csvContent.length;
    const csvSizeKB = csvSize / 1024;
    console.log('[DOWNLOAD] CSV generated:', { 
      size: csvSize, 
      sizeKB: csvSizeKB.toFixed(2) + ' KB',
      firstChars: csvContent.substring(0, 100) 
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:130',message:'CSV content generated',data:{csvSize:csvSize,csvSizeKB:csvSizeKB.toFixed(2),runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    const filename = `balad-scraped-data-${Date.now()}.csv`;
    console.log('[DOWNLOAD] Filename:', filename);
    
    // Use content script for download - avoids service worker data URL crash
    console.log('[DOWNLOAD] Step 4: Sending CSV to content script for download...');
    
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:140',message:'Before tabs.query',data:{csvSize:csvSize,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW10'})}).catch(e=>console.warn('Log fetch failed:',e));
    } catch(e) {}
    // #endregion
    
    // Send to content script instead of background (avoids data URL crash)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // #region agent log
      try {
        fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:148',message:'tabs.query callback',data:{tabsFound:tabs?.length||0,firstTabUrl:tabs?.[0]?.url?.substring(0,50)||'none',runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW11'})}).catch(e=>console.warn('Log fetch failed:',e));
      } catch(e) {}
      // #endregion
      
      if (!tabs[0] || !tabs[0].url || (!tabs[0].url.startsWith('http://') && !tabs[0].url.startsWith('https://'))) {
        console.warn('[DOWNLOAD] No suitable tab, using popup fallback');
        // #region agent log
        try {
          fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:153',message:'No suitable tab, using popup fallback',data:{runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW12'})}).catch(e=>console.warn('Log fetch failed:',e));
        } catch(e) {}
        // #endregion
        downloadCSVFromPopup(csvContent, result.scrapedData.length, filename);
        return;
      }
      
      // #region agent log
      try {
        fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:160',message:'Before sendMessage to content script',data:{tabId:tabs[0].id,csvSize:csvSize,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NEW13'})}).catch(e=>console.warn('Log fetch failed:',e));
      } catch(e) {}
      // #endregion
      
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'download-csv-file',
        csvContent: csvContent,
        filename: filename
      }, (response) => {
        const elapsed = Date.now() - startTime;
        console.log('[DOWNLOAD] Content script response after', elapsed + 'ms:', response);
        console.log('[DOWNLOAD] chrome.runtime.lastError:', chrome.runtime.lastError);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:150',message:'Content script response received',data:{elapsed:elapsed,hasResponse:!!response,success:response?.success,error:response?.error,lastError:chrome.runtime.lastError?.message,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX2'})}).catch(()=>{});
        // #endregion
        
        if (chrome.runtime.lastError) {
          console.error('[DOWNLOAD] Error sending message to content script:', {
            error: chrome.runtime.lastError.message
          });
          showStatus('خطا در ارسال پیام: ' + chrome.runtime.lastError.message, 'error');
          // Fallback: try direct download from popup
          console.log('[DOWNLOAD] Trying popup fallback...');
          downloadCSVFromPopup(csvContent, result.scrapedData.length, filename);
          return;
        }
        
        if (response && response.success) {
          console.log('[DOWNLOAD] ✅ Download successful via content script!');
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:165',message:'Download successful via content script',data:{elapsed:elapsed,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX3'})}).catch(()=>{});
          // #endregion
          
          showStatus(`فایل CSV با ${result.scrapedData.length} کسب‌وکار با موفقیت دانلود شد!`, 'success');
        } else {
          console.warn('[DOWNLOAD] Content script download failed, trying popup fallback');
          downloadCSVFromPopup(csvContent, result.scrapedData.length, filename);
        }
      });
    });
    
    console.log('[DOWNLOAD] Message sent, waiting for response...');
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('[DOWNLOAD] ❌ Exception caught after', elapsed + 'ms:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1dd74b69-a274-4b85-87f6-73e0c1d2bf41',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:189',message:'Exception in download handler',data:{error:error.message,stack:error.stack,name:error.name,elapsed:elapsed,runId:runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    
    showStatus('خطا در دانلود: ' + error.message, 'error');
  }
});

// Fallback: Download from popup using simple blob method - NO CLEANUP
function downloadCSVFromPopup(csvContent, count, filename) {
  const startTime = Date.now();
  console.log('[POPUP-DOWNLOAD] Starting popup download fallback...');
  
  try {
    showStatus('در حال دانلود فایل...', 'info');
    console.log('[POPUP-DOWNLOAD] Step 1: Creating blob...');
    
    // Create blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    console.log('[POPUP-DOWNLOAD] Blob created:', { 
      size: blob.size, 
      type: blob.type 
    });
    
    const url = URL.createObjectURL(blob);
    console.log('[POPUP-DOWNLOAD] Blob URL created:', url);
    
    // Create download link
    console.log('[POPUP-DOWNLOAD] Step 2: Creating download link...');
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `balad-scraped-data-${Date.now()}.csv`;
    link.style.display = 'none';
    console.log('[POPUP-DOWNLOAD] Link created:', { 
      href: link.href, 
      download: link.download 
    });
    
    // Append and click
    console.log('[POPUP-DOWNLOAD] Step 3: Appending link to body...');
    document.body.appendChild(link);
    console.log('[POPUP-DOWNLOAD] Link appended to body');
    
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      try {
        console.log('[POPUP-DOWNLOAD] Step 4: Clicking link...');
        link.click();
        console.log('[POPUP-DOWNLOAD] ✅ Link clicked successfully');
        // NO CLEANUP - browser automatically handles blob URL cleanup
        // This prevents crashes that occur during manual cleanup
        showStatus(`فایل CSV با ${count} کسب‌وکار دانلود شد!`, 'success');
      } catch (e) {
        console.error('[POPUP-DOWNLOAD] ❌ Click failed:', {
          error: e.message,
          stack: e.stack,
          name: e.name
        });
        // Try window.open as last resort
        console.log('[POPUP-DOWNLOAD] Trying window.open as last resort...');
        try {
          window.open(url, '_blank');
          console.log('[POPUP-DOWNLOAD] window.open called');
          showStatus('فایل آماده است. اگر دانلود نشد، از پنجره جدید save کنید.', 'info');
        } catch (openError) {
          console.error('[POPUP-DOWNLOAD] ❌ window.open also failed:', {
            error: openError.message,
            stack: openError.stack
          });
          showStatus('خطا در دانلود: ' + e.message, 'error');
        }
      }
    }, 10);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('[POPUP-DOWNLOAD] ❌ Exception caught after', elapsed + 'ms:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    showStatus('خطا در دانلود: ' + error.message, 'error');
  }
}

// Generate CSV content
function generateCSVContent(businesses) {
  const headers = ['نام کسب‌وکار', 'آدرس', 'شماره تلفن', 'ایمیل', 'وب‌سایت', 'دسته‌بندی'];
  
  const escapeCSV = (field) => {
    if (field === null || field === undefined) return '';
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
    ].join(',');
  });
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  const BOM = '\uFEFF';
  return BOM + csvContent;
}

// Update UI for scraping state
function updateUIForScraping(scraping) {
  startBtn.disabled = scraping;
  startBtn.style.display = scraping ? 'none' : 'inline-block';
  stopBtn.style.display = scraping ? 'inline-block' : 'none';
  progressSection.style.display = scraping ? 'block' : 'none';
  
  // Disable inputs during scraping
  locationInput.disabled = scraping;
  businessNameInput.disabled = scraping;
  hasEmailCheckbox.disabled = scraping;
  hasWebsiteCheckbox.disabled = scraping;
  categoryInput.disabled = scraping;
}

// Update progress
function updateProgress(count) {
  progressCount.textContent = `${count} کسب‌وکار`;
  progressText.textContent = 'در حال اسکرپینگ...';
  // Simple progress bar (can be enhanced with total count)
  progressFill.style.width = '100%';
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 5000);
  }
}

