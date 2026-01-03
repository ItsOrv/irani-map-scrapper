// Test manifest.json structure and Chrome extension requirements

const fs = require('fs');
const path = require('path');

console.log('Testing manifest.json structure...\n');

// Read manifest
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

let errors = [];
let warnings = [];

// Check manifest version
if (manifest.manifest_version !== 3) {
  errors.push('manifest_version must be 3');
} else {
  console.log('✓ manifest_version is 3');
}

// Check required fields
const requiredFields = ['name', 'version', 'description'];
requiredFields.forEach(field => {
  if (!manifest[field]) {
    errors.push(`Missing required field: ${field}`);
  } else {
    console.log(`✓ ${field}: ${manifest[field]}`);
  }
});

// Check permissions
const requiredPermissions = ['activeTab', 'storage', 'tabs', 'downloads'];
const manifestPermissions = manifest.permissions || [];
requiredPermissions.forEach(perm => {
  if (!manifestPermissions.includes(perm)) {
    errors.push(`Missing permission: ${perm}`);
  } else {
    console.log(`✓ Permission: ${perm}`);
  }
});

// Check host_permissions
if (!manifest.host_permissions || manifest.host_permissions.length === 0) {
  warnings.push('No host_permissions specified');
} else {
  console.log(`✓ Host permissions: ${manifest.host_permissions.length} entries`);
}

// Check background service worker
if (!manifest.background || !manifest.background.service_worker) {
  errors.push('Background service worker not specified');
} else {
  const bgPath = path.join(__dirname, '..', manifest.background.service_worker);
  if (!fs.existsSync(bgPath)) {
    errors.push(`Background script not found: ${manifest.background.service_worker}`);
  } else {
    console.log(`✓ Background script exists: ${manifest.background.service_worker}`);
  }
}

// Check popup
if (!manifest.action || !manifest.action.default_popup) {
  warnings.push('No popup specified');
} else {
  const popupPath = path.join(__dirname, '..', manifest.action.default_popup);
  if (!fs.existsSync(popupPath)) {
    errors.push(`Popup file not found: ${manifest.action.default_popup}`);
  } else {
    console.log(`✓ Popup file exists: ${manifest.action.default_popup}`);
  }
}

// Check content scripts
if (!manifest.content_scripts || manifest.content_scripts.length === 0) {
  warnings.push('No content scripts specified');
} else {
  manifest.content_scripts.forEach((script, idx) => {
    if (!script.js || script.js.length === 0) {
      errors.push(`Content script ${idx} has no JS files`);
    } else {
      script.js.forEach(jsFile => {
        const jsPath = path.join(__dirname, '..', jsFile);
        if (!fs.existsSync(jsPath)) {
          errors.push(`Content script not found: ${jsFile}`);
        } else {
          console.log(`✓ Content script exists: ${jsFile}`);
        }
      });
    }
  });
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors.length === 0) {
  console.log('✅ All critical checks passed!');
} else {
  console.log('✗ ERRORS FOUND:');
  errors.forEach(e => console.log(`  - ${e}`));
}

if (warnings.length > 0) {
  console.log('\n⚠ WARNINGS:');
  warnings.forEach(w => console.log(`  - ${w}`));
}

process.exit(errors.length > 0 ? 1 : 0);

