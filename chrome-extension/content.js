// Content script - Adds sidebar to LinkedIn profiles
console.log('LinkedIn CRM Extension: Content script loaded');

// Your CRM API URL
const CRM_API_URL = 'http://localhost:3000/api';

// Theme colors (indigo/purple theme)
const THEME_COLOR = '#6366f1'; // indigo-600
const THEME_COLOR_HOVER = '#4f46e5'; // indigo-700
const THEME_COLOR_LIGHT = '#eef2ff'; // indigo-50

// Use LLM to extract profile data - much more reliable than CSS selectors
async function extractLinkedInProfileWithLLM() {
  try {
    console.log('Extracting profile with LLM...');
    
    // Get the visible text from the page (focus on the main profile area)
    const mainContent = document.querySelector('main') || document.body;
    const pageText = mainContent.innerText.substring(0, 5000); // First 5000 chars should have all profile info
    
    const profileUrl = window.location.href.split('?')[0];
    
    console.log('Sending to LLM for extraction...');
    
    const response = await fetch(`${CRM_API_URL}/extract-linkedin-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pageText: pageText,
        profileUrl: profileUrl,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract profile with LLM');
    }
    
    const result = await response.json();
    console.log('LLM extraction result:', result);
    
    if (!result.success || !result.profile) {
      throw new Error('LLM extraction failed');
    }
    
    // Get profile picture separately (LLM can't see images)
    const profilePicElement = document.querySelector('img.pv-top-card-profile-picture__image');
    const photoUrl = profilePicElement?.src || '';
    
    const profileData = {
      firstName: result.profile.firstName,
      lastName: result.profile.lastName,
      name: `${result.profile.firstName} ${result.profile.lastName}`,
      title: result.profile.title,
      company: result.profile.company,
      location: result.profile.location,
      profileUrl: profileUrl,
      photoUrl: photoUrl,
      extractedAt: new Date().toISOString()
    };
    
    console.log('Final extracted LinkedIn profile (via LLM):', profileData);
    return profileData;
  } catch (error) {
    console.error('Error extracting LinkedIn profile with LLM:', error);
    // Fall back to basic extraction if LLM fails
    return extractLinkedInProfileBasic();
  }
}

// Basic fallback extraction (simplified version)
function extractLinkedInProfileBasic() {
  try {
    console.log('Falling back to basic extraction...');
    
    // Get name from page title or h1
    let name = '';
    const titleMatch = document.title.match(/^\(?(\d+\))?\s*(.+?)\s*[-|]/);
    if (titleMatch) {
      name = titleMatch[2].trim();
    } else {
      const h1 = document.querySelector('h1');
      name = h1?.textContent?.trim() || '';
    }
    
    // Clean up name
    name = name.replace(/^\(\d+\)\s*/, '').trim();
    
    const nameParts = name.split(' ').filter(part => part.length > 0);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const profileUrl = window.location.href.split('?')[0];
    
    return {
      firstName,
      lastName,
      name,
      title: '',
      company: '', // Will prompt user
      location: '',
      profileUrl,
      photoUrl: '',
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in basic extraction:', error);
    return null;
  }
}

// Main extraction function - tries LLM first, falls back to basic
async function extractLinkedInProfile() {
  return await extractLinkedInProfileWithLLM();
}

// Create sidebar
function createSidebar() {
  // Check if sidebar already exists
  if (document.getElementById('crm-sidebar')) {
    return;
  }

  const sidebar = document.createElement('div');
  sidebar.id = 'crm-sidebar';
  sidebar.className = 'crm-sidebar-expanded';
  sidebar.innerHTML = `
    <div id="crm-sidebar-content" style="padding: 24px; height: 100%; display: flex; flex-direction: column;">
      <!-- Toggle Button -->
      <button id="crm-toggle-sidebar" style="
        position: absolute;
        left: -40px;
        top: 20px;
        width: 40px;
        height: 40px;
        background: #000;
        border: none;
        border-radius: 8px 0 0 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.1);
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      <div style="font-size: 18px; font-weight: 600; color: #000; margin-bottom: 24px; letter-spacing: -0.02em;">
        Quick Actions
      </div>
      
      <button id="crm-save-later-btn" style="
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px 20px;
        background-color: #000;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 12px;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        letter-spacing: -0.01em;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Save for Later
      </button>
      
      <button id="crm-send-cadence-btn" style="
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px 20px;
        background-color: white;
        color: #000;
        border: 2px solid #000;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        letter-spacing: -0.01em;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        Send & Add to Cadence
      </button>
    </div>
  `;
  
  // Style the sidebar
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100vh;
    background-color: #fff;
    border-left: 1px solid #e5e7eb;
    box-shadow: -2px 0 12px rgba(0, 0, 0, 0.08);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(sidebar);
  
  // Add event listeners
  const toggleBtn = document.getElementById('crm-toggle-sidebar');
  const saveBtn = document.getElementById('crm-save-later-btn');
  const sendBtn = document.getElementById('crm-send-cadence-btn');
  
  // Toggle sidebar
  let isExpanded = true;
  toggleBtn.addEventListener('click', () => {
    isExpanded = !isExpanded;
    
    if (isExpanded) {
      // Show sidebar
      sidebar.style.right = '0';
      toggleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      `;
    } else {
      // Hide sidebar
      sidebar.style.right = '-320px';
      toggleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;
    }
  });
  
  // Hover effects for Save button
  saveBtn.addEventListener('mouseenter', () => {
    if (!saveBtn.disabled) {
      saveBtn.style.backgroundColor = '#1a1a1a';
      saveBtn.style.transform = 'translateY(-1px)';
      saveBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    }
  });
  saveBtn.addEventListener('mouseleave', () => {
    if (!saveBtn.disabled) {
      saveBtn.style.backgroundColor = '#000';
      saveBtn.style.transform = 'translateY(0)';
      saveBtn.style.boxShadow = 'none';
    }
  });
  
  // Hover effects for Send button
  sendBtn.addEventListener('mouseenter', () => {
    if (!sendBtn.disabled) {
      sendBtn.style.backgroundColor = '#f5f5f5';
    }
  });
  sendBtn.addEventListener('mouseleave', () => {
    if (!sendBtn.disabled) {
      sendBtn.style.backgroundColor = 'white';
    }
  });
  
  // Click handlers
  saveBtn.addEventListener('click', async () => {
    await handleSaveForLater();
  });
  
  sendBtn.addEventListener('click', async () => {
    await handleSendToCadence();
  });
  
  console.log('Sidebar added to page');
}

// Handle "Save for Later" click
async function handleSaveForLater() {
  const button = document.getElementById('crm-save-later-btn');
  const originalHTML = button.innerHTML;
  
  try {
    // Show loading state
    button.disabled = true;
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
      Finding email...
    `;
    
    // Add spin animation
    if (!document.getElementById('crm-spin-style')) {
      const style = document.createElement('style');
      style.id = 'crm-spin-style';
      style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    
    // Extract profile data using LLM
    const profileData = await extractLinkedInProfile();
    if (!profileData || !profileData.profileUrl) {
      throw new Error('Could not extract profile data from this LinkedIn page');
    }
    
    // If still no company after LLM extraction, prompt user to enter it
    if (!profileData.company) {
      const userCompany = prompt(
        `⚠️ Could not auto-detect company for ${profileData.firstName} ${profileData.lastName}\n\n` +
        `Look at their profile - what company is shown near the top?\n\n` +
        `Please enter their company name:`,
        ''
      );
      
      if (!userCompany || userCompany.trim() === '') {
        throw new Error('Company name is required to find email');
      }
      
      profileData.company = userCompany.trim();
      console.log('User entered company:', profileData.company);
    }
    
    console.log('Adding to CRM:', profileData);
    
    // Add to CRM
    let response = await fetch(`${CRM_API_URL}/people/add-from-linkedin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkedinUrl: profileData.profileUrl,
        profileData: profileData,
      }),
    });
    
    // If email not found, let user enter it manually
    if (!response.ok) {
      const error = await response.json();
      
      // Check if it's an email not found error
      if (error.error && error.error.includes('Could not find email')) {
        const manualEmail = prompt(
          `⚠️ Could not find email for ${profileData.firstName} ${profileData.lastName} at ${profileData.company}\n\n` +
          `Hunter.io doesn't have this person's email in their database.\n\n` +
          `If you KNOW their email address, enter it below.\n` +
          `Otherwise, click Cancel to skip this person.`,
          ''
        );
        
        if (manualEmail && manualEmail.includes('@')) {
          // Retry with manual email
          profileData.email = manualEmail.trim();
          console.log('User provided email:', profileData.email);
          
          // Use a different endpoint that accepts email directly
          response = await fetch(`${CRM_API_URL}/people/add-from-linkedin-with-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              linkedinUrl: profileData.profileUrl,
              profileData: profileData,
              email: profileData.email,
            }),
          });
          
          if (!response.ok) {
            const retryError = await response.json();
            throw new Error(retryError.error || 'Failed to add to CRM');
          }
        } else {
          throw new Error('Email not found. Hunter.io does not have this person\'s email in their database.');
        }
      } else {
        throw new Error(error.error || 'Failed to add to CRM');
      }
    }
    
    const result = await response.json();
    console.log('Successfully added to CRM:', result);
    
    // Show success state
    button.style.backgroundColor = '#10b981';
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Added! ✓
    `;
    
    // Show success message
    const emailInfo = result.contact?.email || profileData.email || 'provided';
    const scoreInfo = result.contact?.emailScore ? `\nConfidence: ${result.contact.emailScore}%` : '';
    alert(`✅ Success!\n\n${result.contact?.firstName || profileData.firstName} ${result.contact?.lastName || profileData.lastName} has been added to your CRM!\n\nEmail: ${emailInfo}${scoreInfo}`);
    
    // Reset button after 3 seconds - keep it BLACK
    setTimeout(() => {
      button.disabled = false;
      button.style.backgroundColor = '#000';
      button.innerHTML = originalHTML;
    }, 3000);
    
  } catch (error) {
    console.error('Error adding to CRM:', error);
    
    // Show error state
    button.style.backgroundColor = '#ef4444';
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      Error
    `;
    
    alert(`❌ Error: ${error.message}\n\nPlease try again or check the console for details.`);
    
    // Reset button after 3 seconds - keep it BLACK
    setTimeout(() => {
      button.disabled = false;
      button.style.backgroundColor = '#000';
      button.innerHTML = originalHTML;
    }, 3000);
  }
}

// Handle "Send & Add to Cadence" click - Opens Gmail-style overlay
async function handleSendToCadence() {
  const button = document.getElementById('crm-send-cadence-btn');
  const originalHTML = button.innerHTML;
  
  try {
    // Show loading state
    button.disabled = true;
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
      Loading...
    `;
    
    // Extract profile data using LLM
    const profileData = await extractLinkedInProfile();
    if (!profileData || !profileData.profileUrl) {
      throw new Error('Could not extract profile data from this LinkedIn page');
    }
    
    // If still no company after LLM extraction, prompt user to enter it
    if (!profileData.company) {
      const userCompany = prompt(
        `⚠️ Could not auto-detect company for ${profileData.firstName} ${profileData.lastName}\n\n` +
        `Look at their profile - what company is shown near the top?\n\n` +
        `Please enter their company name:`,
        ''
      );
      
      if (!userCompany || userCompany.trim() === '') {
        throw new Error('Company name is required to find email');
      }
      
      profileData.company = userCompany.trim();
      console.log('User entered company:', profileData.company);
    }
    
    console.log('Fetching cadences...');
    
    // Fetch cadences
    const cadencesResponse = await fetch(`${CRM_API_URL}/cadences/list`);
    if (!cadencesResponse.ok) {
      const errorText = await cadencesResponse.text();
      console.error('Failed to fetch cadences:', errorText);
      throw new Error('Failed to fetch cadences. Make sure your CRM is running.');
    }
    
    const cadences = await cadencesResponse.json();
    
    console.log('Fetched cadences:', cadences);
    
    // Check if we actually have cadences
    if (!cadences || !Array.isArray(cadences) || cadences.length === 0) {
      button.disabled = false;
      button.innerHTML = originalHTML;
      
      alert('⚠️ No Cadences Found\n\nYou need to create a cadence first!\n\n1. Go to your CRM (http://localhost:3000/cadences)\n2. Click "Create Cadence"\n3. Add email templates to your cadence\n4. Come back here and try again!');
      return;
    }
    
    // Validate cadences have required fields
    const validCadences = cadences.filter(c => c && c.id && c.name);
    if (validCadences.length === 0) {
      button.disabled = false;
      button.innerHTML = originalHTML;
      
      alert('⚠️ Invalid Cadences\n\nYour cadences are missing required information. Please check your CRM.');
      return;
    }
    
    // Fetch email WITHOUT adding to CRM yet
    console.log('Finding email for:', profileData.firstName, profileData.lastName, 'at', profileData.company);
    
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
      Finding email...
    `;
    
    // Use the find-email endpoint (doesn't add to CRM)
    let emailFound = false;
    try {
      const response = await fetch(`${CRM_API_URL}/people/find-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          company: profileData.company,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.email) {
          profileData.email = result.email;
          profileData.emailScore = result.score;
          emailFound = true;
          console.log('Found email:', result.email, 'Score:', result.score);
        }
      } else {
        console.warn('Could not find email via Hunter.io');
      }
    } catch (error) {
      console.error('Error finding email:', error);
    }
    
    // If email not found, ask user if they want to manually enter one
    if (!emailFound) {
      button.disabled = false;
      button.innerHTML = originalHTML;
      
      const manualEmail = prompt(
        `⚠️ Could not find email for ${profileData.firstName} ${profileData.lastName} at ${profileData.company}\n\n` +
        `Hunter.io doesn't have this person's email in their database.\n\n` +
        `If you KNOW their email address, enter it below.\n` +
        `Otherwise, click Cancel to skip this person.`,
        ''
      );
      
      if (!manualEmail || !manualEmail.includes('@')) {
        throw new Error('Email not found. Hunter.io does not have this person\'s email in their database.');
      }
      
      profileData.email = manualEmail.trim();
      profileData.emailScore = null; // No confidence score for manual entry
      profileData.manuallyEntered = true;
      console.log('User manually entered email:', profileData.email);
    }
    
    // Reset button
    button.disabled = false;
    button.innerHTML = originalHTML;
    
    // Show Gmail-style overlay
    showGmailOverlay(profileData, validCadences);
    
  } catch (error) {
    console.error('Error in add to cadence:', error);
    
    button.style.backgroundColor = '#ef4444';
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      Error
    `;
    
    alert(`❌ Error: ${error.message}`);
    
    setTimeout(() => {
      button.disabled = false;
      button.style.backgroundColor = 'white';
      button.innerHTML = originalHTML;
    }, 3000);
  }
}

// Helper function to replace variables in text
function replaceVariables(text, profileData) {
  if (!text) return text;
  
  return text
    .replace(/\{\{name\}\}/g, `${profileData.firstName} ${profileData.lastName}`)
    .replace(/\{\{first_name\}\}/g, profileData.firstName)
    .replace(/\{\{last_name\}\}/g, profileData.lastName)
    .replace(/\{\{company\}\}/g, profileData.company)
    .replace(/\{\{position\}\}/g, profileData.position || '');
}

// Show Gmail-style email overlay
async function showGmailOverlay(profileData, cadences) {
  // Create overlay backdrop
  const overlay = document.createElement('div');
  overlay.id = 'crm-gmail-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
  `;
  
  // Create Gmail-style compose window
  const composeWindow = document.createElement('div');
  composeWindow.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    width: 700px;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    animation: slideUp 0.3s ease;
  `;
  
  composeWindow.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
    
    <!-- Header -->
    <div style="
      background: #404040;
      color: white;
      padding: 12px 16px;
      border-radius: 8px 8px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    ">
      <div style="font-size: 14px; font-weight: 500;">New Message</div>
      <button id="crm-close-overlay" style="
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
        opacity: 0.8;
        transition: opacity 0.2s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">×</button>
    </div>
    
    <!-- Email Form -->
    <div style="flex: 1; overflow-y: auto; padding: 16px 20px;">
      <!-- Cadence Selector -->
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 12px; color: #5f6368; margin-bottom: 6px; font-weight: 500;">
          Select Cadence
        </label>
        <select id="crm-cadence-select" style="
          width: 100%;
          padding: 12px 12px;
          border: 1px solid #dadce0;
          border-radius: 4px;
          font-size: 14px;
          line-height: 1.5;
          font-family: 'Google Sans', Roboto, Arial, sans-serif;
          background: white;
          cursor: pointer;
          height: 44px;
        ">
          ${cadences && cadences.length > 0 
            ? cadences.map(c => `<option value="${c.id}">${c.name || 'Unnamed Cadence'}</option>`).join('') 
            : '<option value="">No cadences available - Create one first!</option>'}
        </select>
      </div>
      
      <!-- To Field - Shows email source -->
      <div style="
        border-bottom: 1px solid #e8eaed;
        padding: 8px 0;
      ">
        <div style="display: flex; align-items: center;">
          <span style="color: #5f6368; font-size: 14px; min-width: 60px;">To</span>
          <input id="crm-email-to" type="email" value="${profileData.email || ''}" placeholder="Enter email address" style="
            flex: 1;
            border: none;
            outline: none;
            font-size: 14px;
            color: #202124;
            font-family: 'Google Sans', Roboto, Arial, sans-serif;
          " readonly>
        </div>
        ${profileData.manuallyEntered 
          ? `<div style="margin-left: 60px; margin-top: 4px; font-size: 11px; color: #f59e0b;">⚠️ Manually entered - not verified by Hunter.io</div>`
          : profileData.emailScore 
            ? `<div style="margin-left: 60px; margin-top: 4px; font-size: 11px; color: #10b981;">✓ Found by Hunter.io (${profileData.emailScore}% confidence)</div>`
            : ''}
      </div>
      
      <!-- Subject Field -->
      <div style="
        border-bottom: 1px solid #e8eaed;
        padding: 8px 0;
        display: flex;
        align-items: center;
      ">
        <span style="color: #5f6368; font-size: 14px; min-width: 60px;">Subject</span>
        <input id="crm-email-subject" type="text" value="Quick intro" style="
          flex: 1;
          border: none;
          outline: none;
          font-size: 14px;
          color: #202124;
          font-family: 'Google Sans', Roboto, Arial, sans-serif;
        ">
      </div>
      
      <!-- Email Body -->
      <div style="padding: 16px 0;">
        <div id="crm-email-body" contenteditable="true" style="
          min-height: 300px;
          font-size: 14px;
          line-height: 1.6;
          color: #202124;
          outline: none;
          font-family: Arial, sans-serif;
        ">
          <p>Hi ${profileData.firstName},</p>
          <p>I came across your profile and wanted to reach out...</p>
          <p>Best regards</p>
        </div>
      </div>
    </div>
    
    <!-- Footer with Send Button -->
    <div style="
      padding: 12px 20px;
      border-top: 1px solid #e8eaed;
      display: flex;
      align-items: center;
      gap: 12px;
    ">
      <button id="crm-send-btn" style="
        background: #1a73e8;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 24px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        transition: background 0.2s, box-shadow 0.2s;
        box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
      " onmouseover="this.style.background='#1765cc'; this.style.boxShadow='0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)'" onmouseout="this.style.background='#1a73e8'; this.style.boxShadow='0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)'">
        Send
      </button>
    </div>
  `;
  
  overlay.appendChild(composeWindow);
  document.body.appendChild(overlay);
  
  // Event listeners
  const closeBtn = document.getElementById('crm-close-overlay');
  const sendBtn = document.getElementById('crm-send-btn');
  const cadenceSelect = document.getElementById('crm-cadence-select');
  const subjectInput = document.getElementById('crm-email-subject');
  const bodyDiv = document.getElementById('crm-email-body');
  
  // Function to load cadence email template
  function loadCadenceTemplate(cadenceId) {
    try {
      console.log('Loading template for cadence:', cadenceId);
      
      // Find the cadence in our list
      const cadence = cadences.find(c => c.id === cadenceId);
      if (!cadence) {
        console.error('Cadence not found:', cadenceId);
        return;
      }
      
      console.log('Found cadence:', cadence);
      
      // Find the first email block
      const blocks = cadence.nodes || cadence.blocks || [];
      console.log('Blocks:', blocks);
      
      const firstEmailBlock = blocks.find(block => block && block.type === 'email');
      console.log('First email block:', firstEmailBlock);
      
      if (firstEmailBlock && firstEmailBlock.config) {
        // Replace variables in subject and body
        const subject = replaceVariables(firstEmailBlock.config.subject || 'Quick intro', profileData);
        const body = replaceVariables(firstEmailBlock.config.body || 'Hi {{first_name}},\n\nI came across your profile and wanted to reach out...\n\nBest regards', profileData);
        
        console.log('Replaced subject:', subject);
        console.log('Replaced body:', body);
        
        // Update the UI
        subjectInput.value = subject;
        bodyDiv.innerHTML = body.replace(/\n/g, '<br>');
      } else {
        console.warn('No email block found in cadence, using defaults');
        // Set default template with replaced variables
        subjectInput.value = 'Quick intro';
        bodyDiv.innerHTML = `Hi ${profileData.firstName},<br><br>I came across your profile and wanted to reach out...<br><br>Best regards`;
      }
    } catch (error) {
      console.error('Error loading cadence template:', error);
    }
  }
  
  // Load initial cadence template
  if (cadences.length > 0 && cadenceSelect.value) {
    loadCadenceTemplate(cadenceSelect.value);
  }
  
  // Update email when cadence changes
  cadenceSelect.addEventListener('change', (e) => {
    loadCadenceTemplate(e.target.value);
  });
  
  // Close overlay
  const closeOverlay = () => {
    overlay.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => overlay.remove(), 200);
  };
  
  closeBtn.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });
  
  // Add fadeOut animation
  const style = document.createElement('style');
  style.textContent = '@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }';
  document.head.appendChild(style);
  
  // Send button handler
  sendBtn.addEventListener('click', async () => {
    const selectedCadenceId = cadenceSelect.value;
    const originalHTML = sendBtn.innerHTML;
    
    // Get the edited email, subject and body
    const emailTo = document.getElementById('crm-email-to').value.trim();
    const editedSubject = subjectInput.value;
    const editedBody = bodyDiv.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''); // Convert HTML to plain text
    
    // Validate email
    if (!emailTo) {
      alert('Please enter an email address');
      return;
    }
    
    if (!emailTo.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.6';
    sendBtn.innerHTML = 'Sending...';
    
    try {
      // Call API to add to cadence and send email
      const response = await fetch(`${CRM_API_URL}/linkedin/add-to-cadence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkedinUrl: profileData.profileUrl,
          cadenceId: selectedCadenceId,
          profileData: {
            ...profileData,
            email: emailTo, // Use the edited email
          },
          customEmail: {
            subject: editedSubject,
            body: editedBody,
          },
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }
      
      const result = await response.json();
      console.log('Successfully sent and added to cadence:', result);
      
      // Show success
      sendBtn.style.background = '#1e8e3e';
      sendBtn.innerHTML = 'Sent ✓';
      
      setTimeout(() => {
        closeOverlay();
        alert(`✅ Email sent!\n\n${result.contact.firstName} ${result.contact.lastName} has been added to your cadence!\n\nCheck "Ongoing Outreach" to track them.`);
      }, 1000);
      
    } catch (error) {
      console.error('Error sending email:', error);
      sendBtn.style.background = '#d93025';
      sendBtn.innerHTML = 'Failed';
      alert(`❌ Error: ${error.message}`);
      
      setTimeout(() => {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        sendBtn.style.background = '#1a73e8';
        sendBtn.innerHTML = originalHTML;
      }, 2000);
    }
  });
}

// Initialize when page loads
function init() {
  setTimeout(() => {
    createSidebar();
  }, 2000);
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-create sidebar if it gets removed
const observer = new MutationObserver(() => {
  if (!document.getElementById('crm-sidebar')) {
    createSidebar();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
