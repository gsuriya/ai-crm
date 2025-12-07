// Background service worker - Handles API calls
console.log('LinkedIn CRM Extension: Background script loaded');

// Hunter.io API configuration
const HUNTER_API_KEY = 'YOUR_HUNTER_API_KEY_HERE'; // User needs to add their key

// Your CRM API endpoint
const CRM_API_URL = 'http://localhost:3000/api'; // Update with your actual CRM URL

// Find email using Hunter.io
// NO domain guessing - pass company name directly to Hunter.io
async function findEmail(firstName, lastName, companyName) {
  try {
    if (!HUNTER_API_KEY || HUNTER_API_KEY === 'YOUR_HUNTER_API_KEY_HERE') {
      throw new Error('Hunter.io API key not configured');
    }
    
    const url = `https://api.hunter.io/v2/email-finder?company=${encodeURIComponent(companyName)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${HUNTER_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.data && data.data.email) {
      return {
        success: true,
        email: data.data.email,
        score: data.data.score,
        source: 'hunter.io'
      };
    } else {
      return {
        success: false,
        error: 'Email not found by Hunter.io'
      };
    }
  } catch (error) {
    console.error('Error finding email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Alternative: Use Hunter.io domain search to find company emails
async function searchCompanyEmails(companyDomain) {
  try {
    if (!HUNTER_API_KEY || HUNTER_API_KEY === 'YOUR_HUNTER_API_KEY_HERE') {
      throw new Error('Hunter.io API key not configured');
    }
    
    const url = `https://api.hunter.io/v2/domain-search?domain=${companyDomain}&api_key=${HUNTER_API_KEY}&limit=10`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.data && data.data.emails) {
      return {
        success: true,
        emails: data.data.emails,
        pattern: data.data.pattern
      };
    } else {
      return {
        success: false,
        error: 'No emails found'
      };
    }
  } catch (error) {
    console.error('Error searching company emails:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Add contact to your CRM
async function addToCRM(contactData) {
  try {
    const response = await fetch(`${CRM_API_URL}/contacts/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });
    
    const data = await response.json();
    return {
      success: response.ok,
      data
    };
  } catch (error) {
    console.error('Error adding to CRM:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Send email via your CRM
async function sendEmail(emailData) {
  try {
    const response = await fetch(`${CRM_API_URL}/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });
    
    const data = await response.json();
    return {
      success: response.ok,
      data
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'findEmail') {
    findEmail(request.firstName, request.lastName, request.companyName)
      .then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'searchCompanyEmails') {
    searchCompanyEmails(request.companyDomain)
      .then(sendResponse);
    return true;
  }
  
  if (request.action === 'addToCRM') {
    addToCRM(request.contactData)
      .then(sendResponse);
    return true;
  }
  
  if (request.action === 'sendEmail') {
    sendEmail(request.emailData)
      .then(sendResponse);
    return true;
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('linkedin.com/in/')) {
    chrome.action.openPopup();
  }
});


