// DATA RECOVERY SCRIPT
// Copy and paste this entire script into your browser console (F12 → Console)

console.log('🔍 Starting data recovery...');

// Check all possible localStorage keys
const allKeys = Object.keys(localStorage);
console.log('📋 All localStorage keys:', allKeys);

// Check for contacts in different possible keys
const possibleKeys = ['contacts', 'contactsData', 'localContacts', 'dashboardContacts'];
let foundData = false;

for (const key of possibleKeys) {
    try {
        const data = localStorage.getItem(key);
        if (data && data.length > 10) {
            console.log(`✅ Found data in key "${key}":`, JSON.parse(data));
            foundData = true;
        }
    } catch (e) {
        console.log(`❌ Error reading key "${key}":`, e);
    }
}

// Check ALL localStorage keys for contact-like data
if (!foundData) {
    console.log('🔍 Checking all localStorage keys for contact data...');
    for (const key of allKeys) {
        try {
            const data = localStorage.getItem(key);
            if (data && (data.includes('plant') || data.includes('contact') || data.includes('phone'))) {
                console.log(`🎯 Possible contact data in key "${key}":`, JSON.parse(data));
                foundData = true;
            }
        } catch (e) {
            // Skip invalid JSON
        }
    }
}

if (!foundData) {
    console.log('❌ No local data found. Data may have been cleared.');
    console.log('💡 Try checking if you have data in a different browser or private/incognito mode.');
} else {
    console.log('✅ Data recovery complete! Check the logs above.');
}

// Function to manually restore data if found
window.manualRestore = function(dataArray) {
    console.log('🔄 Manually restoring data...');
    localStorage.setItem('contacts', JSON.stringify(dataArray));
    console.log('✅ Data restored to localStorage');
    location.reload(); // Refresh page
};

console.log('💡 If you found your data above, copy it and run: manualRestore([your_data_here])');