// Global variables
let contacts = [];
let filteredContacts = [];
let editingContactId = null;
let currentView = 'card';
let currentDensity = 'comfortable';
let activeFilters = [];
let searchHistory = [];
let currentTheme = 'light'; // Default to light mode
let touchStartX = 0;
let touchStartY = 0;
let lastSyncTime = null;
let autoSyncInterval = null;

// Bulk operations
let bulkMode = false;
let selectedContacts = new Set();

// Auth variables are accessed via window.currentUser and window.currentOrganization
// These are set by supabase-config.js

document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for supabase-config to initialize
    setTimeout(() => {
        // Initialize based on auth state  
        if (window.currentUser && window.currentOrganization) {
            loadContactsFromSupabase();
        } else {
            loadContactsLocal();
        }
        updateStats();
        renderContacts();
        loadUserPreferences();
    }, 500);
    
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('locationFilter').addEventListener('change', handleFilterChange);
    document.getElementById('statusFilter').addEventListener('change', handleFilterChange);
    document.getElementById('contactForm').addEventListener('submit', handleFormSubmit);
    
    // Close suggestions when clicking outside
    document.addEventListener('click', function(event) {
        const searchBox = document.querySelector('.search-box');
        const suggestions = document.getElementById('searchSuggestions');
        
        if (!searchBox.contains(event.target)) {
            suggestions.style.display = 'none';
        }
        
        const modal = document.getElementById('contactModal');
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Add touch event listeners for swipe gestures
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Show keyboard shortcuts on first visit
    if (!localStorage.getItem('keyboardShortcutsShown')) {
        showKeyboardShortcuts();
        localStorage.setItem('keyboardShortcutsShown', 'true');
    }
    
    // Load theme preference
    loadTheme();
    
    // Start auto-sync (every 30 seconds)
    startAutoSync();
    
    // Update last sync info
    updateLastSyncDisplay();
});

// Initialize contacts loading
function loadContacts() {
    if (window.currentUser && window.currentOrganization) {
        loadContactsFromSupabase();
    } else {
        loadContactsLocal();
    }
}

// Load contacts from Supabase
async function loadContactsFromSupabase() {
    try {
        const { data: contactsData, error } = await supabase
            .from('contacts')
            .select('*')
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        
        // Convert Supabase data to local format
        contacts = contactsData.map(contact => ({
            id: contact.id,
            plantName: contact.plant_name,
            location: contact.location,
            contactName: contact.contact_name,
            phoneNumber: contact.phone_number,
            emailAddress: contact.email_address,
            firstContact: contact.first_contact,
            recentContact: contact.recent_contact,
            nextContact: contact.next_contact,
            frequency: contact.frequency,
            callTime: contact.call_time,
            notes: contact.notes,
            status: contact.status,
            createdAt: contact.created_at,
            updatedAt: contact.updated_at
        }));
        
        // If no contacts exist, migrate from localStorage or create initial data
        if (contacts.length === 0) {
            await migrateLocalData();
        }
        
        filteredContacts = [...contacts];
        updateStats();
        renderContacts();
        
        showToast(`Loaded ${contacts.length} contacts`, 'success', 2000);
        
    } catch (error) {
        handleError(error, 'Load Contacts from Supabase');
        // Fallback to local storage
        loadContactsLocal();
    }
}

// Fallback to local storage
function loadContactsLocal() {
    try {
        const savedContacts = localStorage.getItem('zincContacts');
        if (savedContacts) {
            contacts = JSON.parse(savedContacts);
        } else {
            contacts = getInitialData();
        }
        filteredContacts = [...contacts];
        updateStats();
        renderContacts();
    } catch (error) {
        handleError(error, 'Load Contacts Local');
        contacts = getInitialData();
        filteredContacts = [...contacts];
    }
}

// Migrate existing localStorage data to Supabase
async function migrateLocalData() {
    try {
        const savedContacts = localStorage.getItem('zincContacts');
        if (savedContacts && window.currentOrganization) {
            const localContacts = JSON.parse(savedContacts);
            
            if (localContacts.length > 0) {
                const migratedContacts = localContacts.map(contact => ({
                    plant_name: contact.plantName,
                    location: contact.location,
                    contact_name: contact.contactName,
                    phone_number: contact.phoneNumber,
                    email_address: contact.emailAddress || '',
                    first_contact: contact.firstContact,
                    recent_contact: contact.recentContact,
                    next_contact: contact.nextContact,
                    frequency: contact.frequency,
                    call_time: contact.callTime,
                    notes: contact.notes,
                    status: contact.status || 'inactive',
                    created_by: window.currentUser.id
                }));
                
                const { data, error } = await supabase
                    .from('contacts')
                    .insert(migratedContacts)
                    .select();
                
                if (error) throw error;
                
                // Clear localStorage after successful migration
                localStorage.removeItem('zincContacts');
                
                showToast(`Migrated ${data.length} contacts to cloud storage`, 'success');
                
                // Reload to get the new data with IDs
                await loadContactsFromSupabase();
            }
        }
    } catch (error) {
        console.error('Migration error:', error);
        showToast('Could not migrate local data', 'warning');
    }
}

// Save contact to Supabase
async function saveContactToSupabase(contactData, isUpdate = false, contactId = null) {
    try {
        if (!window.currentOrganization) {
            throw new Error('No organization selected');
        }
        
        const supabaseData = {
            plant_name: contactData.plantName,
            location: contactData.location,
            contact_name: contactData.contactName,
            phone_number: contactData.phoneNumber,
            email_address: contactData.emailAddress || '',
            first_contact: contactData.firstContact,
            recent_contact: contactData.recentContact,
            next_contact: contactData.nextContact,
            frequency: contactData.frequency,
            call_time: contactData.callTime || null,
            notes: contactData.notes,
            status: contactData.status || 'inactive',
            organization_id: window.currentOrganization.id,
            updated_by: window.currentUser.id
        };
        
        if (isUpdate && contactId) {
            const { data, error } = await supabase
                .from('contacts')
                .update(supabaseData)
                .eq('id', contactId)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } else {
            supabaseData.created_by = window.currentUser.id;
            
            const { data, error } = await supabase
                .from('contacts')
                .insert(supabaseData)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        }
        
    } catch (error) {
        console.error('Save to Supabase error:', error);
        // Fallback to localStorage
        saveContactsLocal();
        throw error;
    }
}

// Fallback save to localStorage
function saveContactsLocal() {
    try {
        localStorage.setItem('zincContacts', JSON.stringify(contacts));
    } catch (error) {
        handleError(error, 'Save Contacts Local');
        localStorage.removeItem('contactFormDraft');
        try {
            localStorage.setItem('zincContacts', JSON.stringify(contacts));
        } catch (secondError) {
            showToast('Storage full. Some changes may not be saved.', 'warning');
        }
    }
}

// Delete contact from Supabase
async function deleteContactFromSupabase(contactId) {
    try {
        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', contactId);
        
        if (error) throw error;
        
    } catch (error) {
        console.error('Delete from Supabase error:', error);
        throw error;
    }
}

function getInitialData() {
    return [
        {
            id: generateId(),
            plantName: "EBCO Metal Finishing, LTD",
            location: "BC",
            contactName: "Will & Mary",
            phoneNumber: "",
            firstContact: "2024-09-10",
            recentContact: "2025-07-14",
            nextContact: "2024-09-09",
            frequency: "2-3 months",
            callTime: "",
            notes: "didn't win bet, next material probably sept - Oct",
            status: "follow-up"
        },
        {
            id: generateId(),
            plantName: "Armour Galvanizing",
            location: "",
            contactName: "Gloria",
            phoneNumber: "",
            firstContact: "",
            recentContact: "2025-08-19",
            nextContact: "2025-09-19",
            frequency: "2-3 months",
            callTime: "",
            notes: "Material Not ready yet she said she will reach out once ready",
            status: "pending"
        },
        {
            id: generateId(),
            plantName: "Sureway Group Galvanizing",
            location: "",
            contactName: "Bill",
            phoneNumber: "",
            firstContact: "2024-11-12",
            recentContact: "",
            nextContact: "2025-08-25",
            frequency: "2-3 months",
            callTime: "",
            notes: "No reply from Bill",
            status: "inactive"
        },
        {
            id: generateId(),
            plantName: "AZZ Galvanizing",
            location: "",
            contactName: "Andrew",
            phoneNumber: "",
            firstContact: "2024-09-04",
            recentContact: "2025-04-23",
            nextContact: "2026-02-01",
            frequency: "yearly",
            callTime: "",
            notes: "Did not win bid for 2025, will submit again In 2026 including USA",
            status: "follow-up"
        },
        {
            id: generateId(),
            plantName: "Canadian Galvanizing",
            location: "",
            contactName: "Chris",
            phoneNumber: "",
            firstContact: "2024-08-29",
            recentContact: "2025-07-02",
            nextContact: "",
            frequency: "",
            callTime: "",
            notes: "Reached out multiple times and submitted pricing, did not show interest",
            status: "inactive"
        },
        {
            id: generateId(),
            plantName: "Cascadia Metal",
            location: "",
            contactName: "Alicia, Bill",
            phoneNumber: "",
            firstContact: "2025-04-22",
            recentContact: "2025-07-30",
            nextContact: "",
            frequency: "",
            callTime: "",
            notes: "Multiple emails sent, did not receive a reply",
            status: "inactive"
        },
        {
            id: generateId(),
            plantName: "Court Galvanizing Limited",
            location: "",
            contactName: "Dillon",
            phoneNumber: "",
            firstContact: "2025-06-30",
            recentContact: "2025-07-04",
            nextContact: "",
            frequency: "",
            callTime: "",
            notes: "Correspondence though email, quote submitted, did not get a reply back",
            status: "pending"
        },
        {
            id: generateId(),
            plantName: "Falcon Galvanizing Ltd",
            location: "",
            contactName: "Marc",
            phoneNumber: "204 927 7016",
            firstContact: "2024-10-17",
            recentContact: "2024-12-04",
            nextContact: "2025-08-20",
            frequency: "",
            callTime: "",
            notes: "Mark said on call to write him an email stating the info, no reply after that",
            status: "follow-up"
        },
        {
            id: generateId(),
            plantName: "Galvanisation Quebec - Princeville",
            location: "QC",
            contactName: "",
            phoneNumber: "819-505-4440",
            firstContact: "",
            recentContact: "2024-11-26",
            nextContact: "",
            frequency: "",
            callTime: "",
            notes: "Corbec is their long term contract",
            status: "inactive"
        },
        {
            id: generateId(),
            plantName: "K trail Galvanizing",
            location: "QC",
            contactName: "",
            phoneNumber: "418-248-7018",
            firstContact: "2024-08-30",
            recentContact: "2024-11-26",
            nextContact: "2024-12-02",
            frequency: "",
            callTime: "",
            notes: "Maxim Row is contact for handling zinc byproducts-> Didn't pick phone",
            status: "follow-up"
        },
        {
            id: generateId(),
            plantName: "Nord-Est Métal",
            location: "QC",
            contactName: "Darcy",
            phoneNumber: "(514) 648-9494",
            firstContact: "2024-10-31",
            recentContact: "2024-11-20",
            nextContact: "2024-12-02",
            frequency: "1 month",
            callTime: "",
            notes: "Went to office in ontario, asked to provide us material pics and MSDS, no response yet",
            status: "follow-up"
        },
        {
            id: generateId(),
            plantName: "Red River Galvanizing",
            location: "MB",
            contactName: "",
            phoneNumber: "204-889-1861, 780-236-4258",
            firstContact: "",
            recentContact: "2024-11-26",
            nextContact: "2025-01-14",
            frequency: "",
            callTime: "",
            notes: "Wayne said that they have a steady person who buys product from states",
            status: "follow-up"
        },
        {
            id: generateId(),
            plantName: "Silver City Galvanizing, Inc.",
            location: "BC",
            contactName: "",
            phoneNumber: "",
            firstContact: "2024-10-17",
            recentContact: "2024-11-14",
            nextContact: "2025-01-07",
            frequency: "",
            callTime: "",
            notes: "They have a long term contract with someone",
            status: "inactive"
        },
        {
            id: generateId(),
            plantName: "Sunaar Steel Tube and Galvanizing Inc.",
            location: "ON",
            contactName: "",
            phoneNumber: "-22052",
            firstContact: "2024-10-17",
            recentContact: "2024-11-26",
            nextContact: "2024-12-05",
            frequency: "",
            callTime: "11:00 AM",
            notes: "Contacted sales team, no response through email-> Didn't pick phone",
            status: "follow-up"
        },
        {
            id: generateId(),
            plantName: "Supreme Galvanizing, Ltd.",
            location: "",
            contactName: "",
            phoneNumber: "",
            firstContact: "",
            recentContact: "2024-11-07",
            nextContact: "",
            frequency: "",
            callTime: "",
            notes: "",
            status: "pending"
        },
        {
            id: generateId(),
            plantName: "Valmont Coatings - Pure Metal Galvanizing",
            location: "",
            contactName: "",
            phoneNumber: "",
            firstContact: "",
            recentContact: "2024-11-26",
            nextContact: "2024-12-02",
            frequency: "",
            callTime: "",
            notes: "Plant manager asked to contact mississauga corporate branch, jmiceli@velmont.com",
            status: "follow-up"
        },
        {
            id: generateId(),
            plantName: "Tlirr Group",
            location: "USA",
            contactName: "Bob Olsen",
            phoneNumber: "",
            firstContact: "2024-11-06",
            recentContact: "2024-11-06",
            nextContact: "",
            frequency: "",
            callTime: "",
            notes: "This is in states, rno@tlirr.com",
            status: "active"
        },
        {
            id: generateId(),
            plantName: "Global Metal",
            location: "QC",
            contactName: "Jeff Solomon, Jonathan Schacter",
            phoneNumber: "",
            firstContact: "",
            recentContact: "",
            nextContact: "",
            frequency: "",
            callTime: "",
            notes: "",
            status: "pending"
        },
        {
            id: generateId(),
            plantName: "John Ross",
            location: "",
            contactName: "",
            phoneNumber: "",
            firstContact: "",
            recentContact: "2025-07-30",
            nextContact: "2025-11-14",
            frequency: "",
            callTime: "",
            notes: "",
            status: "follow-up"
        }
    ];
}

function generateId() {
    return Date.now() + Math.random();
}

function updateStats() {
    const totalContacts = contacts.length;
    const activeLeads = contacts.filter(c => c.status === 'active' || c.status === 'pending').length;
    const upcomingFollowUps = contacts.filter(c => {
        if (!c.nextContact) return false;
        const nextDate = new Date(c.nextContact);
        const today = new Date();
        const diffTime = nextDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7 && diffDays >= 0;
    }).length;

    document.getElementById('totalContacts').textContent = totalContacts;
    document.getElementById('activeLeads').textContent = activeLeads;
    document.getElementById('upcomingFollowUps').textContent = upcomingFollowUps;
}

function renderContacts() {
    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
        showLoadingSkeleton();
        
        // Debounce rapid renders
        clearTimeout(renderContacts.timeout);
        renderContacts.timeout = setTimeout(() => {
            hideLoadingSkeleton();
            
            if (filteredContacts.length === 0) {
                showEmptyState();
                return;
            }
            
            hideEmptyState();
            
            if (currentView === 'card') {
                renderCardView();
            } else {
                renderListView();
            }
            
            // Use intersection observer for lazy animation
            observeCards();
        }, 100);
    });
}

// Intersection Observer for performance
let cardObserver;

function observeCards() {
    if (cardObserver) cardObserver.disconnect();
    
    cardObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                cardObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    const cards = document.querySelectorAll('.contact-card, .list-row');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = `opacity 0.4s ease ${index * 0.05}s, transform 0.4s ease ${index * 0.05}s`;
        cardObserver.observe(card);
    });
}

function renderCardView() {
    const grid = document.getElementById('contactsGrid');
    const list = document.getElementById('contactsList');
    
    grid.style.display = 'grid';
    list.style.display = 'none';
    
    grid.className = `contacts-grid ${currentDensity}`;
    grid.innerHTML = '';
    
    filteredContacts.forEach(contact => {
        const card = createContactCard(contact);
        grid.appendChild(card);
    });
}

function renderListView() {
    const grid = document.getElementById('contactsGrid');
    const list = document.getElementById('contactsList');
    
    grid.style.display = 'none';
    list.style.display = 'block';
    
    list.innerHTML = `
        <div class="list-header">
            <div>Company</div>
            <div>Contact</div>
            <div>Location</div>
            <div>Status</div>
            <div>Next Contact</div>
            <div>Actions</div>
        </div>
        ${filteredContacts.map((contact, index) => `
            <div class="list-row" style="animation-delay: ${index * 0.05}s" onclick="editContact('${contact.id}')">
                <div>
                    <div class="company-name" style="font-size: 0.875rem; margin-bottom: 0.25rem;">${contact.plantName}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${contact.notes ? contact.notes.substring(0, 50) + '...' : ''}</div>
                </div>
                <div>${contact.contactName || 'N/A'}</div>
                <div>${contact.location || 'N/A'}</div>
                <div>
                    <span class="status-indicator status-${contact.status || 'inactive'}"></span>
                    ${formatStatus(contact.status)}
                </div>
                <div>${formatDate(contact.nextContact)}</div>
                <div class="contact-actions always-visible">
                    <button class="action-btn edit-btn" onclick="event.stopPropagation(); editContact('${contact.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="event.stopPropagation(); deleteContact('${contact.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('')}
    `;
}

function showLoadingSkeleton() {
    const skeleton = document.getElementById('loadingSkeleton');
    const grid = document.getElementById('contactsGrid');
    const list = document.getElementById('contactsList');
    
    grid.style.display = 'none';
    list.style.display = 'none';
    skeleton.style.display = 'grid';
    
    // Generate skeleton based on current view
    if (currentView === 'list') {
        skeleton.className = 'loading-skeleton list-view';
        skeleton.innerHTML = Array(8).fill(0).map(() => `
            <div class="skeleton-card list-item">
                <div class="skeleton-circle"></div>
                <div style="flex: 1;">
                    <div class="skeleton-line short" style="margin-bottom: 0.5rem;"></div>
                    <div class="skeleton-line medium" style="margin-bottom: 0;"></div>
                </div>
            </div>
        `).join('');
    } else {
        skeleton.className = 'loading-skeleton';
        skeleton.innerHTML = Array(6).fill(0).map((_, index) => `
            <div class="skeleton-card" style="animation-delay: ${index * 0.1}s;">
                <div class="skeleton-line short"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <div class="skeleton-line" style="width: 80px; height: 30px; margin-bottom: 0;"></div>
                    <div class="skeleton-line" style="width: 60px; height: 30px; margin-bottom: 0;"></div>
                </div>
            </div>
        `).join('');
    }
}

function hideLoadingSkeleton() {
    document.getElementById('loadingSkeleton').style.display = 'none';
}

// Button loading states
function showButtonLoading(button, originalText) {
    if (typeof button === 'string') {
        button = document.getElementById(button);
    }
    if (!button) return;
    
    button.classList.add('btn-loading');
    button.disabled = true;
    
    // Store original text and wrap it
    if (!button.querySelector('.btn-text')) {
        button.innerHTML = `<span class="btn-text">${originalText || button.textContent}</span>`;
    }
}

function hideButtonLoading(button, originalText) {
    if (typeof button === 'string') {
        button = document.getElementById(button);
    }
    if (!button) return;
    
    button.classList.remove('btn-loading');
    button.disabled = false;
    
    if (originalText) {
        button.innerHTML = originalText;
    } else {
        const textSpan = button.querySelector('.btn-text');
        if (textSpan) {
            button.innerHTML = textSpan.textContent;
        }
    }
}

// Form loading overlay
function showFormLoading(formElement) {
    if (typeof formElement === 'string') {
        formElement = document.getElementById(formElement);
    }
    if (formElement) {
        formElement.classList.add('form-loading');
    }
}

function hideFormLoading(formElement) {
    if (typeof formElement === 'string') {
        formElement = document.getElementById(formElement);
    }
    if (formElement) {
        formElement.classList.remove('form-loading');
    }
}

function showEmptyState() {
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('contactsGrid').style.display = 'none';
    document.getElementById('contactsList').style.display = 'none';
}

function hideEmptyState() {
    document.getElementById('emptyState').style.display = 'none';
}

function createContactCard(contact) {
    const card = document.createElement('div');
    card.className = 'contact-card';
    card.dataset.contactId = contact.id;
    
    // Set up click handler based on mode
    if (bulkMode) {
        card.classList.add('bulk-mode');
        card.onclick = handleContactSelection;
        if (selectedContacts.has(contact.id.toString())) {
            card.classList.add('selected');
        }
    } else {
        card.onclick = () => editContact(contact.id);
    }

    const statusClass = `status-${contact.status || 'inactive'}`;
    const priorityClass = getPriorityClass(contact);
    
    card.innerHTML = `
        <div class="contact-header">
            <div class="contact-title">
                <div class="company-name">${contact.plantName}</div>
                <div class="contact-person">${contact.contactName || 'No contact person'}</div>
            </div>
            <div class="contact-badges">
                <div class="location-badge">${contact.location || 'Unknown'}</div>
                ${priorityClass ? `<div class="priority-badge ${priorityClass}">!</div>` : ''}
            </div>
        </div>
        
        <div class="contact-info">
            <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">
                    <span class="status-indicator ${statusClass}"></span>
                    ${formatStatus(contact.status)}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Phone</div>
                <div class="info-value">
                    ${contact.phoneNumber ? `
                        <a href="tel:${contact.phoneNumber}" onclick="event.stopPropagation();" class="phone-link">
                            <i class="fas fa-phone"></i> ${contact.phoneNumber}
                        </a>
                    ` : 'N/A'}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Recent Contact</div>
                <div class="info-value">${formatDate(contact.recentContact)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Next Contact</div>
                <div class="info-value">${formatDate(contact.nextContact)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Frequency</div>
                <div class="info-value">${contact.frequency || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Call Time</div>
                <div class="info-value">${contact.callTime || 'N/A'}</div>
            </div>
        </div>
        
        ${contact.notes ? `
            <div class="contact-notes">
                <div class="info-label">Notes</div>
                <div class="notes-text">${contact.notes}</div>
            </div>
        ` : ''}
        
        <div class="contact-actions">
            ${contact.phoneNumber ? `
                <button class="action-btn call-btn" onclick="event.stopPropagation(); window.open('tel:${contact.phoneNumber}')" title="Call">
                    <i class="fas fa-phone"></i>
                </button>
            ` : ''}
            <button class="action-btn edit-btn" onclick="event.stopPropagation(); editContact('${contact.id}')" title="Edit">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete-btn" onclick="event.stopPropagation(); deleteContact('${contact.id}')" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return card;
}

function getPriorityClass(contact) {
    if (!contact.nextContact) return null;
    
    const nextDate = new Date(contact.nextContact);
    const today = new Date();
    const diffTime = nextDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'urgent';
    if (diffDays <= 3) return 'high';
    if (diffDays <= 7) return 'medium';
    return null;
}

function formatStatus(status) {
    const statusMap = {
        'active': 'Active',
        'pending': 'Pending Response',
        'follow-up': 'Follow-up Needed',
        'inactive': 'Inactive'
    };
    return statusMap[status] || 'Unknown';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let formattedDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    if (diffDays === 0) {
        formattedDate += ' (Today)';
    } else if (diffDays === 1) {
        formattedDate += ' (Tomorrow)';
    } else if (diffDays > 0 && diffDays <= 7) {
        formattedDate += ` (${diffDays} days)`;
    } else if (diffDays < 0 && diffDays >= -7) {
        formattedDate += ` (${Math.abs(diffDays)} days ago)`;
    }
    
    return formattedDate;
}

function handleSearch(event) {
    const searchTerm = event.target.value;
    
    if (searchTerm.length >= 2) {
        showSearchSuggestions(searchTerm);
    } else {
        hideSearchSuggestions();
    }
    
    filterContacts();
}

function showSearchSuggestions(searchTerm) {
    const suggestions = document.getElementById('searchSuggestions');
    const matches = contacts.filter(contact => {
        return contact.plantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (contact.contactName && contact.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
               (contact.location && contact.location.toLowerCase().includes(searchTerm.toLowerCase()));
    }).slice(0, 5);
    
    if (matches.length > 0) {
        suggestions.innerHTML = matches.map(contact => `
            <div class="suggestion-item" onclick="selectSuggestion('${contact.plantName}')">
                <strong>${contact.plantName}</strong>
                ${contact.contactName ? ` - ${contact.contactName}` : ''}
                ${contact.location ? ` (${contact.location})` : ''}
            </div>
        `).join('');
        suggestions.style.display = 'block';
    } else {
        hideSearchSuggestions();
    }
}

function hideSearchSuggestions() {
    document.getElementById('searchSuggestions').style.display = 'none';
}

function selectSuggestion(plantName) {
    document.getElementById('searchInput').value = plantName;
    hideSearchSuggestions();
    filterContacts();
}

function handleFilterChange() {
    updateActiveFilters();
    filterContacts();
}

function updateActiveFilters() {
    const filtersContainer = document.getElementById('activeFilters');
    const locationFilter = document.getElementById('locationFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchInput').value;
    
    activeFilters = [];
    
    if (searchTerm) {
        activeFilters.push({ type: 'search', value: searchTerm, label: `Search: "${searchTerm}"` });
    }
    
    if (locationFilter) {
        activeFilters.push({ type: 'location', value: locationFilter, label: `Location: ${locationFilter}` });
    }
    
    if (statusFilter) {
        activeFilters.push({ type: 'status', value: statusFilter, label: `Status: ${formatStatus(statusFilter)}` });
    }
    
    filtersContainer.innerHTML = activeFilters.map(filter => `
        <div class="filter-tag">
            ${filter.label}
            <span class="remove-filter" onclick="removeFilter('${filter.type}')">
                <i class="fas fa-times"></i>
            </span>
        </div>
    `).join('');
}

function removeFilter(type) {
    switch (type) {
        case 'search':
            document.getElementById('searchInput').value = '';
            break;
        case 'location':
            document.getElementById('locationFilter').value = '';
            break;
        case 'status':
            document.getElementById('statusFilter').value = '';
            break;
    }
    
    handleFilterChange();
}

function quickFilter(type) {
    clearAllFilters();
    
    switch (type) {
        case 'follow-up':
            document.getElementById('statusFilter').value = 'follow-up';
            break;
        case 'recent':
            // Filter contacts with recent contact in last 30 days
            const recentContacts = contacts.filter(contact => {
                if (!contact.recentContact) return false;
                const recentDate = new Date(contact.recentContact);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return recentDate >= thirtyDaysAgo;
            });
            // This is a custom filter, handle it differently
            filteredContacts = recentContacts;
            renderContacts();
            return;
        case 'inactive':
            document.getElementById('statusFilter').value = 'inactive';
            break;
    }
    
    handleFilterChange();
}

function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('locationFilter').value = '';
    document.getElementById('statusFilter').value = '';
    handleFilterChange();
}

// Debounced filtering for performance
let filterTimeout;

function filterContacts() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const locationFilter = document.getElementById('locationFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        
        // Use more efficient filtering with early returns
        filteredContacts = contacts.filter(contact => {
            // Quick search term check first
            if (searchTerm !== '') {
                const searchFields = [
                    contact.plantName,
                    contact.contactName,
                    contact.location,
                    contact.notes
                ].filter(Boolean).join(' ').toLowerCase();
                
                if (!searchFields.includes(searchTerm)) {
                    return false;
                }
            }
            
            // Then filter checks
            if (locationFilter !== '' && contact.location !== locationFilter) {
                return false;
            }
            
            if (statusFilter !== '' && contact.status !== statusFilter) {
                return false;
            }
            
            return true;
        });
        
        renderContacts();
    }, 150);
}

function openAddContactModal() {
    editingContactId = null;
    document.getElementById('modalTitle').textContent = 'Add New Contact';
    document.getElementById('contactForm').reset();
    
    // Clear any existing errors
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('has-error');
        const error = group.querySelector('.error-message');
        if (error) error.remove();
    });
    
    document.getElementById('contactModal').style.display = 'block';
    
    // Focus first input for accessibility
    setTimeout(() => {
        document.getElementById('plantName').focus();
    }, 100);
    
    setupAutoSave();
    loadDraft();
}

function editContact(contactId) {
    const contact = contacts.find(c => c.id == contactId);
    if (!contact) return;
    
    editingContactId = contactId;
    document.getElementById('modalTitle').textContent = 'Edit Contact';
    
    document.getElementById('plantName').value = contact.plantName || '';
    document.getElementById('location').value = contact.location || '';
    document.getElementById('contactName').value = contact.contactName || '';
    document.getElementById('phoneNumber').value = contact.phoneNumber || '';
    document.getElementById('firstContact').value = contact.firstContact || '';
    document.getElementById('recentContact').value = contact.recentContact || '';
    document.getElementById('nextContact').value = contact.nextContact || '';
    document.getElementById('frequency').value = contact.frequency || '';
    document.getElementById('callTime').value = contact.callTime || '';
    document.getElementById('notes').value = contact.notes || '';
    
    document.getElementById('contactModal').style.display = 'block';
}

async function deleteContact(contactId) {
    const contact = contacts.find(c => c.id == contactId);
    
    if (!confirm(`Are you sure you want to delete ${contact.plantName}?`)) {
        return;
    }
    
    try {
        if (window.currentUser && window.currentOrganization) {
            // Delete from Supabase
            await deleteContactFromSupabase(contactId);
            showToast('Contact deleted successfully', 'success');
        } else {
            // Fallback to local storage
            saveContactsLocal();
            showToast('Contact deleted locally', 'warning');
        }
        
        // Remove from local data
        contacts = contacts.filter(c => c.id != contactId);
        filterContacts();
        updateStats();
        
    } catch (error) {
        console.error('Delete contact error:', error);
        showToast('Error deleting contact: ' + error.message, 'error');
    }
}

function closeModal() {
    document.getElementById('contactModal').style.display = 'none';
    editingContactId = null;
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!validateForm()) {
        showToast('Please fix the errors and try again', 'error');
        return;
    }
    
    const submitBtn = event.target.querySelector('[type="submit"]');
    const form = event.target;
    
    showButtonLoading(submitBtn);
    showFormLoading(form);
    
    try {
        const formData = {
            plantName: document.getElementById('plantName').value,
            location: document.getElementById('location').value,
            contactName: document.getElementById('contactName').value,
            phoneNumber: document.getElementById('phoneNumber').value,
            emailAddress: document.getElementById('emailAddress')?.value || '',
            firstContact: document.getElementById('firstContact').value,
            recentContact: document.getElementById('recentContact').value,
            nextContact: document.getElementById('nextContact').value,
            frequency: document.getElementById('frequency').value,
            callTime: document.getElementById('callTime').value,
            notes: document.getElementById('notes').value
        };
        
        formData.status = determineStatus(formData);
        
        if (editingContactId) {
            // Update existing contact
            if (window.currentUser && window.currentOrganization) {
                const savedContact = await saveContactToSupabase(formData, true, editingContactId);
                
                // Update local data
                const contactIndex = contacts.findIndex(c => c.id == editingContactId);
                if (contactIndex !== -1) {
                    contacts[contactIndex] = {
                        id: savedContact.id,
                        plantName: savedContact.plant_name,
                        location: savedContact.location,
                        contactName: savedContact.contact_name,
                        phoneNumber: savedContact.phone_number,
                        emailAddress: savedContact.email_address,
                        firstContact: savedContact.first_contact,
                        recentContact: savedContact.recent_contact,
                        nextContact: savedContact.next_contact,
                        frequency: savedContact.frequency,
                        callTime: savedContact.call_time,
                        notes: savedContact.notes,
                        status: savedContact.status,
                        updatedAt: savedContact.updated_at
                    };
                }
                
                showToast('Contact updated successfully', 'success');
            } else {
                // Fallback to local storage
                const contactIndex = contacts.findIndex(c => c.id == editingContactId);
                if (contactIndex !== -1) {
                    contacts[contactIndex] = { ...contacts[contactIndex], ...formData };
                }
                saveContactsLocal();
                showToast('Contact updated locally', 'warning');
            }
        } else {
            // Create new contact
            if (window.currentUser && window.currentOrganization) {
                const savedContact = await saveContactToSupabase(formData, false);
                
                // Add to local data
                const newContact = {
                    id: savedContact.id,
                    plantName: savedContact.plant_name,
                    location: savedContact.location,
                    contactName: savedContact.contact_name,
                    phoneNumber: savedContact.phone_number,
                    emailAddress: savedContact.email_address,
                    firstContact: savedContact.first_contact,
                    recentContact: savedContact.recent_contact,
                    nextContact: savedContact.next_contact,
                    frequency: savedContact.frequency,
                    callTime: savedContact.call_time,
                    notes: savedContact.notes,
                    status: savedContact.status,
                    createdAt: savedContact.created_at,
                    updatedAt: savedContact.updated_at
                };
                
                contacts.unshift(newContact); // Add to beginning
                showToast('Contact added successfully', 'success');
            } else {
                // Fallback to local storage
                const newContact = {
                    id: generateId(),
                    ...formData
                };
                contacts.unshift(newContact);
                saveContactsLocal();
                showToast('Contact added locally', 'warning');
            }
        }
        
        filterContacts();
        updateStats();
        clearDraft();
        closeModal();
        
    } catch (error) {
        console.error('Form submit error:', error);
        
        // More specific error messages
        let errorMessage = 'Error saving contact';
        if (error.message.includes('organization')) {
            errorMessage = 'Organization error. Please try signing out and signing back in.';
        } else if (error.message.includes('JWT') || error.message.includes('auth')) {
            errorMessage = 'Authentication error. Please sign in again.';
        } else if (error.message.includes('duplicate') || error.message.includes('unique')) {
            errorMessage = 'A contact with this information already exists.';
        } else if (error.message) {
            errorMessage += ': ' + error.message;
        }
        
        showToast(errorMessage, 'error', 5000);
    } finally {
        hideButtonLoading(submitBtn, 'Save Contact');
        hideFormLoading(form);
    }
}

// View and layout functions
function setView(view) {
    currentView = view;
    
    // Update button states
    document.querySelectorAll('.layout-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(view + 'ViewBtn').classList.add('active');
    
    saveUserPreferences();
    renderContacts();
}

function setDensity(density) {
    currentDensity = density;
    
    // Update button states
    document.querySelectorAll('.density-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(density + 'Btn').classList.add('active');
    
    saveUserPreferences();
    
    if (currentView === 'card') {
        renderCardView();
    }
}

function saveUserPreferences() {
    const preferences = {
        view: currentView,
        density: currentDensity
    };
    localStorage.setItem('zincDashboardPreferences', JSON.stringify(preferences));
}

function loadUserPreferences() {
    const saved = localStorage.getItem('zincDashboardPreferences');
    if (saved) {
        const preferences = JSON.parse(saved);
        currentView = preferences.view || 'card';
        currentDensity = preferences.density || 'comfortable';
        
        // Update UI
        setView(currentView);
        setDensity(currentDensity);
    }
}

// Global variables for keyboard navigation
let focusedIndex = -1;
let focusableElements = [];

function handleKeyboardShortcuts(event) {
    // Don't handle shortcuts when typing in inputs
    const isTyping = event.target.matches('input, textarea, select, [contenteditable]');
    
    // Always handle these regardless of focus
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        document.getElementById('searchInput').focus();
        return;
    }
    
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        syncData();
        return;
    }
    
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        openAddContactModal();
        return;
    }
    
    // Modal shortcuts
    if (document.getElementById('contactModal').style.display !== 'none') {
        if (event.key === 'Escape') {
            closeModal();
        }
        return;
    }
    
    // Bulk mode shortcuts
    if (bulkMode) {
        if (event.key === 'Escape') {
            exitBulkMode();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            event.preventDefault();
            selectAll();
            return;
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            bulkDelete();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
            event.preventDefault();
            bulkExport();
            return;
        }
    }
    
    // Don't handle other shortcuts when typing
    if (isTyping) return;
    
    // Global navigation shortcuts
    switch (event.key) {
        case 'Escape':
            // Clear search or exit bulk mode
            if (document.getElementById('searchInput').value) {
                document.getElementById('searchInput').value = '';
                filterContacts();
            } else if (bulkMode) {
                exitBulkMode();
            }
            break;
            
        case '1':
            setView('card');
            break;
            
        case '2':
            setView('list');
            break;
            
        case '3':
            setDensity('compact');
            break;
            
        case '4':
            setDensity('comfortable');
            break;
            
        case '5':
            setDensity('spacious');
            break;
            
        case 's':
            if (event.shiftKey) {
                toggleBulkMode();
            }
            break;
            
        case 'h':
            showKeyboardShortcuts();
            break;
            
        case '/':
            event.preventDefault();
            document.getElementById('searchInput').focus();
            break;
            
        case 'ArrowDown':
            event.preventDefault();
            navigateContacts('down');
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            navigateContacts('up');
            break;
            
        case 'ArrowLeft':
            event.preventDefault();
            navigateContacts('left');
            break;
            
        case 'ArrowRight':
            event.preventDefault();
            navigateContacts('right');
            break;
            
        case 'Enter':
            if (focusedIndex >= 0 && focusableElements[focusedIndex]) {
                event.preventDefault();
                if (bulkMode) {
                    // Toggle selection in bulk mode
                    focusableElements[focusedIndex].click();
                } else {
                    // Edit contact
                    const contactId = focusableElements[focusedIndex].dataset.contactId;
                    if (contactId) editContact(contactId);
                }
            }
            break;
            
        case ' ':
            // Spacebar to select/deselect in bulk mode
            if (bulkMode && focusedIndex >= 0 && focusableElements[focusedIndex]) {
                event.preventDefault();
                focusableElements[focusedIndex].click();
            }
            break;
    }
}

function navigateContacts(direction) {
    updateFocusableElements();
    
    if (focusableElements.length === 0) return;
    
    // Remove previous focus
    if (focusedIndex >= 0 && focusableElements[focusedIndex]) {
        focusableElements[focusedIndex].classList.remove('keyboard-focus');
    }
    
    const isGridView = currentView === 'card';
    const columns = isGridView ? getGridColumns() : 1;
    
    switch (direction) {
        case 'down':
            if (isGridView) {
                focusedIndex = Math.min(focusedIndex + columns, focusableElements.length - 1);
            } else {
                focusedIndex = Math.min(focusedIndex + 1, focusableElements.length - 1);
            }
            break;
            
        case 'up':
            if (isGridView) {
                focusedIndex = Math.max(focusedIndex - columns, 0);
            } else {
                focusedIndex = Math.max(focusedIndex - 1, 0);
            }
            break;
            
        case 'left':
            if (isGridView) {
                focusedIndex = Math.max(focusedIndex - 1, 0);
            }
            break;
            
        case 'right':
            if (isGridView) {
                focusedIndex = Math.min(focusedIndex + 1, focusableElements.length - 1);
            }
            break;
    }
    
    // If no element was focused, start with the first one
    if (focusedIndex < 0 && focusableElements.length > 0) {
        focusedIndex = 0;
    }
    
    // Apply focus
    if (focusedIndex >= 0 && focusableElements[focusedIndex]) {
        const element = focusableElements[focusedIndex];
        element.classList.add('keyboard-focus');
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function updateFocusableElements() {
    focusableElements = Array.from(document.querySelectorAll('.contact-card:not([style*="display: none"])'));
}

function getGridColumns() {
    const grid = document.getElementById('contactsGrid');
    if (!grid) return 1;
    
    const gridComputedStyle = window.getComputedStyle(grid);
    const gridTemplateColumns = gridComputedStyle.gridTemplateColumns;
    
    // Count the number of columns
    return gridTemplateColumns.split(' ').length;
}

function determineStatus(contact) {
    const today = new Date();
    const nextContactDate = contact.nextContact ? new Date(contact.nextContact) : null;
    const recentContactDate = contact.recentContact ? new Date(contact.recentContact) : null;
    
    if (nextContactDate) {
        const diffTime = nextContactDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7 && diffDays >= 0) {
            return 'follow-up';
        }
    }
    
    if (recentContactDate) {
        const diffTime = today - recentContactDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 30) {
            return 'active';
        } else if (diffDays <= 90) {
            return 'pending';
        }
    }
    
    return 'inactive';
}

// Theme functions
function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme();
    localStorage.setItem('zincDashboardTheme', currentTheme);
}

function loadTheme() {
    const saved = localStorage.getItem('zincDashboardTheme');
    if (saved) {
        currentTheme = saved;
    } else {
        // Detect system preference (default to light)
        currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.className = currentTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // Also update the theme toggle button appearance
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.setAttribute('aria-label', 
            currentTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
        );
    }
}

// Touch gesture functions
function handleTouchStart(event) {
    if (event.touches.length === 1) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    }
}

function handleTouchMove(event) {
    if (!touchStartX || !touchStartY) return;
    
    if (event.touches.length === 1) {
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;
        
        const diffX = touchStartX - touchX;
        const diffY = touchStartY - touchY;
        
        // Check if it's a horizontal swipe on a contact card
        const target = event.target.closest('.contact-card');
        if (target && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            event.preventDefault();
            target.classList.add('swiping');
            target.style.setProperty('--swipe-distance', `${-diffX}px`);
            
            if (Math.abs(diffX) > 100) {
                target.classList.add('swipe-action');
            } else {
                target.classList.remove('swipe-action');
            }
        }
        
        // Pull to refresh detection
        if (diffY < -100 && window.scrollY === 0) {
            const container = document.querySelector('.contacts-container');
            container.classList.add('pull-to-refresh', 'pulling');
        }
    }
}

function handleTouchEnd(event) {
    const target = event.target.closest('.contact-card');
    if (target && target.classList.contains('swiping')) {
        const swipeDistance = parseInt(target.style.getPropertyValue('--swipe-distance')) || 0;
        
        if (Math.abs(swipeDistance) > 100) {
            // Perform swipe action (e.g., quick call)
            const phoneNumber = target.querySelector('.phone-link')?.href;
            if (phoneNumber) {
                window.open(phoneNumber);
                showToast('Calling...', 'success');
            }
        }
        
        target.classList.remove('swiping', 'swipe-action');
        target.style.removeProperty('--swipe-distance');
    }
    
    // Handle pull to refresh
    const container = document.querySelector('.contacts-container');
    if (container.classList.contains('pulling')) {
        setTimeout(() => {
            container.classList.remove('pull-to-refresh', 'pulling');
            loadContacts();
            renderContacts();
            showToast('Contacts refreshed', 'success');
        }, 1000);
    }
    
    touchStartX = 0;
    touchStartY = 0;
}

// Toast notification system
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-header">
            <span><i class="fas ${icons[type]}"></i> ${type.charAt(0).toUpperCase() + type.slice(1)}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="toast-body">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Keyboard shortcuts display
function showKeyboardShortcuts() {
    const shortcuts = document.getElementById('keyboardShortcuts');
    shortcuts.classList.add('show');
    
    setTimeout(() => {
        shortcuts.classList.remove('show');
    }, 5000);
}

// Enhanced form validation
function validateForm() {
    const form = document.getElementById('contactForm');
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        const group = field.closest('.form-group');
        const existing = group.querySelector('.error-message');
        if (existing) existing.remove();
        
        if (!field.value.trim()) {
            isValid = false;
            group.classList.add('has-error');
            const error = document.createElement('div');
            error.className = 'error-message';
            const labelText = field.labels && field.labels[0] ? 
                field.labels[0].textContent.replace(' *', '') : 
                field.getAttribute('placeholder') || 'This field';
            error.textContent = `${labelText} is required`;
            group.appendChild(error);
        } else {
            group.classList.remove('has-error');
        }
    });
    
    // Email validation
    const emailField = document.getElementById('emailAddress');
    if (emailField && emailField.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const group = emailField.closest('.form-group');
        
        if (!emailRegex.test(emailField.value)) {
            isValid = false;
            group.classList.add('has-error');
            const error = document.createElement('div');
            error.className = 'error-message';
            error.textContent = 'Please enter a valid email address';
            group.appendChild(error);
        }
    }
    
    return isValid;
}

// Auto-save functionality
let autoSaveTimer;

function setupAutoSave() {
    const form = document.getElementById('contactForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
                saveDraft();
            }, 1000);
        });
    });
}

function saveDraft() {
    const formData = new FormData(document.getElementById('contactForm'));
    const draft = {};
    
    for (let [key, value] of formData.entries()) {
        draft[key] = value;
    }
    
    localStorage.setItem('contactFormDraft', JSON.stringify(draft));
    showToast('Draft saved', 'info', 1000);
}

function loadDraft() {
    const draft = localStorage.getItem('contactFormDraft');
    if (draft && !editingContactId) {
        const data = JSON.parse(draft);
        const form = document.getElementById('contactForm');
        
        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) field.value = data[key];
        });
        
        showToast('Draft loaded', 'info', 2000);
    }
}

function clearDraft() {
    localStorage.removeItem('contactFormDraft');
}

// Performance optimizations
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Virtual scrolling for large datasets
class VirtualScrollManager {
    constructor(container, itemHeight, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.items = [];
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.totalHeight = 0;
        
        this.container.addEventListener('scroll', throttle(() => this.updateVisible(), 16));
        window.addEventListener('resize', debounce(() => this.updateVisible(), 100));
    }
    
    setItems(items) {
        this.items = items;
        this.totalHeight = items.length * this.itemHeight;
        this.updateVisible();
    }
    
    updateVisible() {
        const containerHeight = this.container.clientHeight;
        const scrollTop = this.container.scrollTop;
        
        this.visibleStart = Math.floor(scrollTop / this.itemHeight);
        this.visibleEnd = Math.min(
            this.visibleStart + Math.ceil(containerHeight / this.itemHeight) + 1,
            this.items.length
        );
        
        this.render();
    }
    
    render() {
        const visibleItems = this.items.slice(this.visibleStart, this.visibleEnd);
        const offsetY = this.visibleStart * this.itemHeight;
        
        this.container.innerHTML = `
            <div style="height: ${offsetY}px;"></div>
            ${visibleItems.map(item => this.renderItem(item)).join('')}
            <div style="height: ${this.totalHeight - offsetY - (visibleItems.length * this.itemHeight)}px;"></div>
        `;
    }
}

// Memory management
function cleanupUnusedData() {
    // Clear old search suggestions
    const suggestions = document.getElementById('searchSuggestions');
    if (suggestions && !suggestions.style.display !== 'none') {
        suggestions.innerHTML = '';
    }
    
    // Clean up old toast notifications
    const toasts = document.querySelectorAll('.toast');
    if (toasts.length > 5) {
        Array.from(toasts).slice(0, -5).forEach(toast => toast.remove());
    }
    
    // Clear old animation delays
    const animatedElements = document.querySelectorAll('[style*="animation-delay"]');
    animatedElements.forEach(el => {
        el.style.animationDelay = '';
    });
}

// Run cleanup periodically (every 5 minutes)
setInterval(cleanupUnusedData, 300000);

// Error handling and logging
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    showToast('An error occurred. Please refresh the page if problems persist.', 'error');
}

// Global error handler
window.addEventListener('error', (event) => {
    if (event.error) {
        handleError(event.error, 'Global');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (event.reason) {
        handleError(event.reason, 'Promise');
    }
});

// Service worker registration for offline support (only for HTTPS/localhost)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('SW registered: ', registration);
        } catch (registrationError) {
            console.log('SW registration failed: ', registrationError);
        }
    });
} else if (location.protocol === 'file:') {
    console.log('Service worker not available for file:// protocol. Use a local server or HTTPS for offline features.');
}

// Export data functionality
// Manual and automatic sync functions
async function syncData() {
    const syncBtn = document.getElementById('syncBtn');
    const syncIcon = document.getElementById('syncIcon');
    
    if (!syncBtn || syncBtn.classList.contains('syncing')) {
        return; // Already syncing
    }
    
    try {
        // Update button state
        syncBtn.classList.add('syncing');
        syncBtn.disabled = true;
        
        // Show sync indicator
        showSyncIndicator('syncing', 'Syncing with cloud...');
        
        if (window.currentUser && window.currentOrganization) {
            // Reload from Supabase
            await loadContactsFromSupabase();
            lastSyncTime = new Date();
            
            // Success state
            syncBtn.classList.remove('syncing');
            syncBtn.classList.add('success');
            showSyncIndicator('success', 'Sync complete!');
            showToast('Data synced successfully', 'success', 2000);
            
            // Reset button after 2 seconds
            setTimeout(() => {
                syncBtn.classList.remove('success');
                syncBtn.disabled = false;
                hideSyncIndicator();
            }, 2000);
            
        } else {
            // Not logged in, fallback to local
            loadContactsLocal();
            lastSyncTime = new Date();
            
            syncBtn.classList.remove('syncing');
            syncBtn.classList.add('success');
            showSyncIndicator('success', 'Local data refreshed');
            showToast('Local data refreshed', 'info', 2000);
            
            setTimeout(() => {
                syncBtn.classList.remove('success');
                syncBtn.disabled = false;
                hideSyncIndicator();
            }, 2000);
        }
        
        updateLastSyncDisplay();
        
    } catch (error) {
        console.error('Sync error:', error);
        
        // Error state
        syncBtn.classList.remove('syncing');
        syncBtn.classList.add('error');
        showSyncIndicator('error', 'Sync failed');
        showToast('Sync failed: ' + error.message, 'error');
        
        // Reset button after 3 seconds
        setTimeout(() => {
            syncBtn.classList.remove('error');
            syncBtn.disabled = false;
            hideSyncIndicator();
        }, 3000);
    }
}

function startAutoSync() {
    // Auto-sync every 2 minutes if user is logged in (reduced frequency)
    autoSyncInterval = setInterval(async () => {
        if (window.currentUser && window.currentOrganization && document.visibilityState === 'visible') {
            try {
                // Only sync if user is actively using the app
                if (document.hasFocus && document.hasFocus()) {
                    showSyncIndicator('syncing', 'Auto-syncing...', true);
                    await loadContactsFromSupabase();
                    lastSyncTime = new Date();
                    showSyncIndicator('success', 'Auto-sync complete', true);
                    updateLastSyncDisplay();
                    
                    setTimeout(() => hideSyncIndicator(), 2000);
                }
            } catch (error) {
                console.error('Auto-sync error:', error);
                // Don't show error indicator for auto-sync failures to avoid annoying users
                setTimeout(() => hideSyncIndicator(), 1000);
                
                // If it's an auth error, stop auto-sync to prevent further issues
                if (error.message && (error.message.includes('JWT') || error.message.includes('auth'))) {
                    console.log('Stopping auto-sync due to auth error');
                    clearInterval(autoSyncInterval);
                    autoSyncInterval = null;
                }
            }
        }
    }, 120000); // 2 minutes instead of 30 seconds
}

function showSyncIndicator(type, message, isAutoSync = false) {
    let indicator = document.getElementById('autoSyncIndicator');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'autoSyncIndicator';
        indicator.className = 'auto-sync-indicator';
        document.body.appendChild(indicator);
    }
    
    indicator.className = `auto-sync-indicator show ${type}`;
    indicator.innerHTML = `
        <div class="sync-status-icon ${type === 'syncing' ? 'spinning' : ''}"></div>
        <span>${message}</span>
    `;
}

function hideSyncIndicator() {
    const indicator = document.getElementById('autoSyncIndicator');
    if (indicator) {
        indicator.classList.remove('show');
    }
}

function updateLastSyncDisplay() {
    const syncBtn = document.getElementById('syncBtn');
    if (!syncBtn) return;
    
    // Remove existing last sync info
    const existingInfo = syncBtn.querySelector('.last-sync-info');
    if (existingInfo) existingInfo.remove();
    
    if (lastSyncTime) {
        const timeAgo = getTimeAgo(lastSyncTime);
        const syncInfo = document.createElement('div');
        syncInfo.className = 'last-sync-info';
        syncInfo.textContent = `Last sync: ${timeAgo}`;
        syncBtn.appendChild(syncInfo);
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
}

// Enhanced export with sync check
function exportData(format = 'csv') {
    try {
        // Auto-sync before export if possible
        if (window.currentUser && window.currentOrganization) {
            syncData().then(() => performExport(format));
        } else {
            performExport(format);
        }
    } catch (error) {
        handleError(error, 'Export');
    }
}

function performExport(format) {
    try {
        let data, filename, mimeType;
        
        if (format === 'csv') {
            const headers = ['Plant Name', 'Location', 'Contact', 'Phone', 'Status', 'Next Contact', 'Notes'];
            const rows = contacts.map(contact => [
                contact.plantName,
                contact.location || '',
                contact.contactName || '',
                contact.phoneNumber || '',
                formatStatus(contact.status),
                contact.nextContact || '',
                contact.notes || ''
            ]);
            
            data = [headers, ...rows].map(row => 
                row.map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(',')
            ).join('\n');
            
            filename = `gemini-contacts-${new Date().toISOString().split('T')[0]}.csv`;
            mimeType = 'text/csv';
        } else if (format === 'json') {
            data = JSON.stringify(contacts, null, 2);
            filename = `gemini-contacts-${new Date().toISOString().split('T')[0]}.json`;
            mimeType = 'application/json';
        }
        
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast(`Data exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
        handleError(error, 'Export');
    }
}

// Bulk Operations
function toggleBulkMode() {
    bulkMode = !bulkMode;
    selectedContacts.clear();
    
    const bulkBtn = document.getElementById('bulkModeBtn');
    const bulkBar = document.getElementById('bulkActionsBar');
    
    if (bulkMode) {
        bulkBtn.classList.add('active');
        bulkBtn.innerHTML = '<i class="fas fa-times"></i> Exit';
        bulkBar.style.display = 'flex';
        
        // Re-render contacts to add bulk mode
        renderContacts();
    } else {
        exitBulkMode();
    }
    
    updateSelectedCount();
}

function exitBulkMode() {
    bulkMode = false;
    selectedContacts.clear();
    
    const bulkBtn = document.getElementById('bulkModeBtn');
    const bulkBar = document.getElementById('bulkActionsBar');
    
    bulkBtn.classList.remove('active');
    bulkBtn.innerHTML = '<i class="fas fa-check-square"></i> Select';
    bulkBar.style.display = 'none';
    
    // Re-render contacts to remove bulk mode
    renderContacts();
    updateSelectedCount();
}

function handleContactSelection(event) {
    if (!bulkMode) return;
    
    event.stopPropagation();
    event.preventDefault();
    
    const card = event.currentTarget;
    const contactId = card.dataset.contactId;
    
    if (selectedContacts.has(contactId)) {
        selectedContacts.delete(contactId);
        card.classList.remove('selected');
    } else {
        selectedContacts.add(contactId);
        card.classList.add('selected');
    }
    
    updateSelectedCount();
}

function updateSelectedCount() {
    const countEl = document.getElementById('selectedCount');
    const selectAllBtn = document.getElementById('selectAllBtn');
    
    if (countEl) {
        countEl.textContent = selectedContacts.size;
    }
    
    // Update select all button
    if (selectAllBtn && bulkMode) {
        const visibleContacts = document.querySelectorAll('.contact-card:not([style*="display: none"])');
        const allSelected = visibleContacts.length > 0 && selectedContacts.size === visibleContacts.length;
        
        selectAllBtn.innerHTML = allSelected 
            ? '<i class="fas fa-square"></i> Deselect All'
            : '<i class="fas fa-check-double"></i> Select All';
    }
    
    // Enable/disable bulk action buttons
    const hasSelection = selectedContacts.size > 0;
    document.querySelectorAll('.bulk-actions .btn-secondary, .bulk-actions .btn-danger').forEach(btn => {
        if (btn.id !== 'selectAllBtn' && !btn.textContent.includes('Cancel')) {
            btn.disabled = !hasSelection;
            btn.style.opacity = hasSelection ? '1' : '0.5';
        }
    });
}

function selectAll() {
    const visibleContacts = document.querySelectorAll('.contact-card:not([style*="display: none"])');
    const allSelected = selectedContacts.size === visibleContacts.length && visibleContacts.length > 0;
    
    if (allSelected) {
        // Deselect all
        selectedContacts.clear();
        visibleContacts.forEach(card => card.classList.remove('selected'));
    } else {
        // Select all visible
        selectedContacts.clear();
        visibleContacts.forEach(card => {
            const contactId = card.dataset.contactId;
            if (contactId) {
                selectedContacts.add(contactId);
                card.classList.add('selected');
            }
        });
    }
    
    updateSelectedCount();
}

async function bulkDelete() {
    if (selectedContacts.size === 0) return;
    
    const confirmed = confirm(`Are you sure you want to delete ${selectedContacts.size} contact${selectedContacts.size > 1 ? 's' : ''}? This action cannot be undone.`);
    if (!confirmed) return;
    
    const deleteBtn = document.querySelector('.bulk-actions .btn-danger');
    showButtonLoading(deleteBtn, 'Deleting...');
    
    try {
        const contactIds = Array.from(selectedContacts);
        let deletedCount = 0;
        
        for (const contactId of contactIds) {
            try {
                if (window.currentUser && window.currentOrganization) {
                    // Delete from Supabase
                    const { error } = await supabase
                        .from('contacts')
                        .delete()
                        .eq('id', contactId);
                    
                    if (error) throw error;
                }
                
                // Remove from local array
                contacts = contacts.filter(c => c.id.toString() !== contactId);
                deletedCount++;
                
            } catch (error) {
                console.error(`Failed to delete contact ${contactId}:`, error);
            }
        }
        
        // Save to localStorage
        saveContactsLocal();
        
        // Update UI
        filterContacts();
        updateStats();
        exitBulkMode();
        
        showToast(`${deletedCount} contact${deletedCount > 1 ? 's' : ''} deleted successfully`, 'success');
        
    } catch (error) {
        console.error('Bulk delete error:', error);
        showToast('Error deleting contacts: ' + error.message, 'error');
    } finally {
        hideButtonLoading(deleteBtn, '<i class="fas fa-trash"></i> Delete');
    }
}

function bulkExport() {
    if (selectedContacts.size === 0) return;
    
    const selectedContactsData = contacts.filter(contact => 
        selectedContacts.has(contact.id.toString())
    );
    
    // Use the existing export function with selected data
    try {
        const headers = ['Plant Name', 'Location', 'Contact', 'Phone', 'Status', 'Next Contact', 'Notes'];
        const rows = selectedContactsData.map(contact => [
            contact.plantName,
            contact.location || '',
            contact.contactName || '',
            contact.phoneNumber || '',
            formatStatus(contact.status),
            contact.nextContact || '',
            contact.notes || ''
        ]);
        
        const data = [headers, ...rows].map(row => 
            row.map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        const filename = `gemini-contacts-selected-${new Date().toISOString().split('T')[0]}.csv`;
        const blob = new Blob([data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast(`Exported ${selectedContacts.size} selected contacts`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Error exporting contacts', 'error');
    }
}

function bulkEdit() {
    if (selectedContacts.size === 0) return;
    
    // For now, show a message that this feature is coming
    showToast('Bulk edit feature coming soon! Export selected contacts to edit in spreadsheet.', 'info', 4000);
}