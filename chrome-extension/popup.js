// Popup script - Handles UI interactions
let currentProfile = null;
let foundEmail = null;

// Load profile data when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check if we're on a LinkedIn profile page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url || !tab.url.includes('linkedin.com/in/')) {
      showError();
      return;
    }
    
    // Try to get cached profile data first
    const storage = await chrome.storage.local.get('lastExtractedProfile');
    if (storage.lastExtractedProfile) {
      displayProfile(storage.lastExtractedProfile);
      hideLoading();
      return;
    }
    
    // If no cached data, extract from page
    chrome.tabs.sendMessage(tab.id, { action: 'extractProfile' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        showError();
        return;
      }
      
      if (response && response.success && response.data) {
        displayProfile(response.data);
      } else {
        showError();
      }
      hideLoading();
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    showError();
    hideLoading();
  }
});

function displayProfile(profile) {
  currentProfile = profile;
  
  // Update UI elements
  document.getElementById('profileName').textContent = profile.name || 'Unknown';
  document.getElementById('profileHeadline').textContent = profile.headline || 'No headline';
  document.getElementById('profileCompany').textContent = profile.currentCompany || 'Unknown';
  document.getElementById('profilePosition').textContent = profile.currentPosition || 'Unknown';
  document.getElementById('profileLocation').textContent = profile.location || 'Unknown';
  
  // Set profile picture
  const profilePic = document.getElementById('profilePic');
  if (profile.profilePicUrl) {
    profilePic.src = profile.profilePicUrl;
  } else {
    profilePic.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23d1d5db"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
  }
  
  document.getElementById('content').style.display = 'block';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

function showError() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'block';
}

// Find email button
document.getElementById('findEmailBtn').addEventListener('click', async () => {
  if (!currentProfile) return;
  
  const btn = document.getElementById('findEmailBtn');
  btn.disabled = true;
  btn.textContent = 'Finding email...';
  
  try {
    // Parse name
    const nameParts = currentProfile.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[nameParts.length - 1] || '';
    
    // Extract domain from company name (simplified)
    const company = currentProfile.currentCompany.toLowerCase();
    let domain = company.replace(/\s+/g, '') + '.com';
    
    // Try to guess better domain (you might want to improve this)
    if (company.includes('google')) domain = 'google.com';
    if (company.includes('microsoft')) domain = 'microsoft.com';
    if (company.includes('apple')) domain = 'apple.com';
    // Add more company mappings as needed
    
    // Call background script to find email
    chrome.runtime.sendMessage({
      action: 'findEmail',
      firstName,
      lastName,
      companyDomain: domain
    }, (response) => {
      btn.disabled = false;
      btn.textContent = 'Find Email with Hunter.io';
      
      const resultDiv = document.getElementById('emailResult');
      resultDiv.style.display = 'block';
      
      if (response && response.success) {
        foundEmail = response.email;
        resultDiv.className = 'email-result email-found';
        resultDiv.innerHTML = `
          <strong>✓ Email found!</strong><br>
          ${response.email}<br>
          <small>Confidence: ${response.score}%</small>
        `;
        
        // Show send email button
        document.getElementById('sendEmailBtn').style.display = 'block';
      } else {
        resultDiv.className = 'email-result email-error';
        resultDiv.innerHTML = `
          <strong>✗ Email not found</strong><br>
          ${response.error || 'Could not find email'}
        `;
      }
    });
  } catch (error) {
    console.error('Error finding email:', error);
    btn.disabled = false;
    btn.textContent = 'Find Email with Hunter.io';
    
    const resultDiv = document.getElementById('emailResult');
    resultDiv.style.display = 'block';
    resultDiv.className = 'email-result email-error';
    resultDiv.textContent = 'Error: ' + error.message;
  }
});

// Add to CRM button
document.getElementById('addToCRMBtn').addEventListener('click', async () => {
  if (!currentProfile) return;
  
  const btn = document.getElementById('addToCRMBtn');
  btn.disabled = true;
  btn.textContent = 'Adding to CRM...';
  
  const contactData = {
    firstName: currentProfile.name.split(' ')[0],
    lastName: currentProfile.name.split(' ').slice(1).join(' '),
    email: foundEmail || '',
    company: currentProfile.currentCompany,
    position: currentProfile.currentPosition,
    location: currentProfile.location,
    linkedinUrl: currentProfile.profileUrl,
    headline: currentProfile.headline,
    about: currentProfile.about
  };
  
  chrome.runtime.sendMessage({
    action: 'addToCRM',
    contactData
  }, (response) => {
    btn.disabled = false;
    
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.style.display = 'block';
    
    if (response && response.success) {
      btn.textContent = '✓ Added to CRM';
      btn.className = 'btn-success';
      statusDiv.className = 'success-message';
      statusDiv.textContent = 'Successfully added to CRM!';
      
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    } else {
      btn.textContent = 'Add to CRM';
      statusDiv.className = 'error-message';
      statusDiv.textContent = 'Error: ' + (response.error || 'Failed to add to CRM');
    }
  });
});

// Send email button
document.getElementById('sendEmailBtn').addEventListener('click', async () => {
  if (!currentProfile || !foundEmail) return;
  
  const btn = document.getElementById('sendEmailBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  const emailData = {
    to: foundEmail,
    subject: `Quick question about ${currentProfile.currentCompany}`,
    body: `Hi ${currentProfile.name.split(' ')[0]},\n\nI came across your profile and wanted to reach out...\n\nBest regards`,
    contactName: currentProfile.name,
    company: currentProfile.currentCompany
  };
  
  chrome.runtime.sendMessage({
    action: 'sendEmail',
    emailData
  }, (response) => {
    btn.disabled = false;
    btn.textContent = 'Send Email';
    
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.style.display = 'block';
    
    if (response && response.success) {
      statusDiv.className = 'success-message';
      statusDiv.textContent = 'Email sent successfully!';
    } else {
      statusDiv.className = 'error-message';
      statusDiv.textContent = 'Error: ' + (response.error || 'Failed to send email');
    }
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  });
});




