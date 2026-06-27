document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuth();
  
  // Initialize specific page logic based on elements present
  if (document.getElementById('theme-toggle')) {
    setupThemeToggle();
  }
});

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('avatarforge_theme');
  if (savedTheme) {
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } else {
    // System match logic is handled by CSS, but we ensure icons reflect it
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
       document.documentElement.setAttribute('data-theme', 'dark');
    } else {
       document.documentElement.setAttribute('data-theme', 'light');
    }
  }
  updateThemeIcons();
}

function setupThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('avatarforge_theme', newTheme);
    updateThemeIcons();
  });
}

function updateThemeIcons() {
  const moonIcon = document.getElementById('moon-icon');
  const sunIcon = document.getElementById('sun-icon');
  if (!moonIcon || !sunIcon) return;

  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme === 'dark') {
    moonIcon.classList.add('hidden');
    sunIcon.classList.remove('hidden');
  } else {
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }
}

// --- Auth Management ---
function initAuth() {
  const principalKey = 'avatarforge_principal';
  const principal = localStorage.getItem(principalKey);
  const signinBtn = document.getElementById('signin-btn');
  
  if (signinBtn) {
    if (principal) {
      // User is logged in
      signinBtn.textContent = 'Sign Out';
      signinBtn.classList.remove('btn-primary');
      signinBtn.classList.add('btn-secondary');
      signinBtn.onclick = () => {
        localStorage.removeItem(principalKey);
        window.location.reload();
      };
    } else {
      // User is guest
      signinBtn.textContent = 'Sign In';
      signinBtn.classList.add('btn-primary');
      signinBtn.classList.remove('btn-secondary');
      signinBtn.onclick = () => {
        window.location.href = 'signin.html';
      };
    }
  }
}

// --- Shared Utilities ---
function showSpinner(spinner) { if(spinner) spinner.classList.remove('hidden'); }
function hideSpinner(spinner) { if(spinner) spinner.classList.add('hidden'); }
function resetResult(img, dl, placeholder) {
  if(img) img.classList.add('hidden');
  if(dl) dl.classList.add('hidden');
  if(placeholder) placeholder.classList.remove('hidden');
}

// --- AI Generator Logic ---
async function generateAvatar() {
  const promptInput = document.getElementById('prompt');
  if (!promptInput) return; // Not on AI page

  const prompt = promptInput.value.trim();
  const style = document.getElementById('style').value;
  const spinner = document.getElementById('spinner');
  const resultImg = document.getElementById('result');
  const downloadBtn = document.getElementById('download');

  resetResult(resultImg, downloadBtn, null);
  showSpinner(spinner);

  try {
    const response = await fetch('http://localhost:5000/avatar/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style })
    });
    
    if (!response.ok) throw new Error(`Server responded ${response.status}`);
    const data = await response.json();
    if (!data.image) throw new Error('No image URL returned');
    
    resultImg.src = data.image;
    resultImg.classList.remove('hidden');
    downloadBtn.href = data.image;
    downloadBtn.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Failed to generate avatar: ' + err.message);
  } finally {
    hideSpinner(spinner);
  }
}

// --- Manual Generator Logic ---
async function generateManualAvatar() {
  if (!document.getElementById('manual-style')) return; // Not on manual page

  const opts = {
    gender: document.getElementById('manual-gender').value,
    style: document.getElementById('manual-style').value,
    top: document.getElementById('manual-top').value,
    accessories: document.getElementById('manual-accessories').value,
    hairColor: document.getElementById('manual-haircolor').value,
    facialHair: document.getElementById('manual-facialhair').value,
    clothes: document.getElementById('manual-clothes').value,
    eyes: document.getElementById('manual-eyes').value,
    eyebrow: document.getElementById('manual-eyebrow').value,
    mouth: document.getElementById('manual-mouth').value,
    skin: document.getElementById('manual-skin').value
  };
  
  const prompt = `Create a high quality portrait avatar of a ${opts.gender}. Style: ${opts.style}. Hair: ${opts.top}, Hair Color: ${opts.hairColor}. Accessories: ${opts.accessories}. Facial Hair: ${opts.facialHair}. Clothing: ${opts.clothes}. Eyes: ${opts.eyes}. Eyebrows: ${opts.eyebrow}. Mouth: ${opts.mouth}. Skin Tone: ${opts.skin}. Make it centered with a clean background.`;

  const spinner = document.getElementById('manual-spinner');
  const resultImg = document.getElementById('manual-result');
  const downloadBtn = document.getElementById('manual-download');
  const placeholder = document.getElementById('manual-placeholder');

  resetResult(resultImg, downloadBtn, placeholder);
  if(placeholder) placeholder.classList.add('hidden');
  showSpinner(spinner);

  try {
    const imgUrl = `http://localhost:5000/avatar/proxy-image?prompt=${encodeURIComponent(prompt)}`;
    const response = await fetch(imgUrl);
    if (!response.ok) throw new Error('Image service error');
    
    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    
    resultImg.src = objectURL;
    resultImg.classList.remove('hidden');
    downloadBtn.href = objectURL;
    downloadBtn.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Failed to generate manual avatar: ' + err.message);
    if(placeholder) placeholder.classList.remove('hidden');
  } finally {
    hideSpinner(spinner);
  }
}
