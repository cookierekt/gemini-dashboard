// Supabase Configuration
// Replace these with your actual Supabase project details

const SUPABASE_URL = 'https://wvkixjygtfsjxurailsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2a2l4anlndGZzanh1cmFpbHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxODU4NTYsImV4cCI6MjA3MTc2MTg1Nn0._bD3pJWRI4G8nbLuphmWzHhXMGI3D-Shx377UlXuHy8';

// Initialize Supabase client
let supabase = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.supabase !== 'undefined') {
        const { createClient } = window.supabase;
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized');
        initializeAuth();
    } else {
        console.warn('Supabase library not loaded. Working in offline mode.');
        showAuthModal();
    }
});

// Global variables for Supabase integration (shared with script.js)
window.currentUser = null;
window.currentOrganization = null;
let realtimeSubscription = null;

// Remove duplicate DOMContentLoaded listener - moved above

// Authentication functions
async function initializeAuth() {
    try {
        if (!supabase) {
            console.warn('Supabase not initialized, working in offline mode');
            showAuthModal();
            return;
        }
        
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            await handleAuthSuccess(session.user);
        } else {
            showAuthModal();
        }
        
        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event);
            
            if (event === 'SIGNED_IN' && session) {
                await handleAuthSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                // Only handle sign out if it's not already handled
                if (window.currentUser) {
                    console.log('Handling sign out event');
                    handleSignOut();
                }
            }
            // Ignore TOKEN_REFRESHED and other events that don't require action
        });
        
    } catch (error) {
        console.error('Auth initialization error:', error);
        showAuthModal();
    }
}

async function handleAuthSuccess(user) {
    window.currentUser = user;
    
    try {
        // Get or create user profile
        await ensureUserProfile(user);
        
        // Set default organization (skip organization tables for now)
        window.currentOrganization = {
            id: 'default-org',
            name: 'Gemini Global',
            created_by: user.id
        };
        
        // Hide auth modal, show main dashboard
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('mainDashboard').style.display = 'block';
        document.getElementById('userProfile').style.display = 'block';
        
        // Update user UI
        updateUserProfile();
        
        // Load contacts and start real-time sync
        await loadContactsFromSupabase();
        startRealtimeSync();
        
        showToast('Welcome to Gemini Global Dashboard!', 'success');
        
    } catch (error) {
        console.error('Post-auth setup error:', error);
        handleError(error, 'Authentication');
    }
}

async function ensureUserProfile(user) {
    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
                id: user.id,
                full_name: user.user_metadata?.full_name || user.email,
                avatar_url: user.user_metadata?.avatar_url
            });
        
        if (insertError) throw insertError;
    }
}

async function loadUserOrganization() {
    const { data: memberships, error } = await supabase
        .from('organization_members')
        .select(`
            role,
            organizations (
                id,
                name,
                created_by
            )
        `)
        .eq('user_id', window.currentUser.id);
    
    if (error) throw error;
    
    if (memberships && memberships.length > 0) {
            window.currentOrganization = memberships[0].organizations;
    } else {
        // Create new organization for first-time user
        await createUserOrganization();
    }
}

async function createUserOrganization() {
    const orgName = prompt('Enter your organization name:', 'Gemini Global Inc.') || 'My Organization';
    
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
            name: orgName,
            created_by: window.currentUser.id
        })
        .select()
        .single();
    
    if (orgError) throw orgError;
    
    const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
            user_id: window.currentUser.id,
            role: 'owner'
        });
    
    if (memberError) throw memberError;
    
    window.currentOrganization = org;
}

function updateUserProfile() {
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    userName.textContent = window.currentUser.user_metadata?.full_name || window.currentUser.email;
    userAvatar.src = window.currentUser.user_metadata?.avatar_url || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.textContent)}&background=3b82f6&color=fff`;
}

// Auth UI functions
function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const nameGroup = document.getElementById('nameGroup');
    const orgGroup = document.getElementById('orgGroup');
    const authTitle = document.getElementById('authTitle');
    const authSubmit = document.getElementById('authSubmit');
    const authSwitchText = document.getElementById('authSwitchText');
    
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'signup') {
        nameGroup.style.display = 'block';
        orgGroup.style.display = 'block';
        authTitle.textContent = 'Create Account';
        authSubmit.textContent = 'Sign Up';
        authSwitchText.innerHTML = 'Already have an account? <a href="#" onclick="switchAuthTab(\'signin\')">Sign in</a>';
    } else {
        nameGroup.style.display = 'none';
        orgGroup.style.display = 'none';
        authTitle.textContent = 'Welcome Back';
        authSubmit.textContent = 'Sign In';
        authSwitchText.innerHTML = 'Don\'t have an account? <a href="#" onclick="switchAuthTab(\'signup\')">Sign up</a>';
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const isSignUp = document.querySelector('.auth-tab.active').textContent === 'Sign Up';
    const submitBtn = document.getElementById('authSubmit');
    
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;
    
    try {
        if (isSignUp) {
            const name = document.getElementById('authName').value;
            const orgName = document.getElementById('authOrg').value;
            
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        organization_name: orgName
                    }
                }
            });
            
            if (error) throw error;
            
            if (data.user && !data.session) {
                showToast('Check your email to confirm your account!', 'info');
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
        }
        
    } catch (error) {
        console.error('Auth error:', error);
        showToast(error.message || 'Authentication failed', 'error');
    } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
    }
}

async function signInWithGoogle() {
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.href
            }
        });
        
        if (error) throw error;
        
    } catch (error) {
        console.error('Google sign-in error:', error);
        showToast(error.message, 'error');
    }
}

async function signOut() {
    try {
        // Clean up real-time subscription
        if (realtimeSubscription) {
            realtimeSubscription.unsubscribe();
            realtimeSubscription = null;
        }
        
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
    } catch (error) {
        console.error('Sign out error:', error);
        showToast(error.message, 'error');
    }
}

function handleSignOut() {
    window.currentUser = null;
    window.currentOrganization = null;
    
    document.getElementById('authModal').style.display = 'block';
    document.getElementById('mainDashboard').style.display = 'none';
    document.getElementById('userProfile').style.display = 'none';
    
    // Reset form
    document.getElementById('authForm').reset();
    switchAuthTab('signin');
}

function showAuthModal() {
    // Wait for DOM to be ready
    const showModal = () => {
        const authModal = document.getElementById('authModal');
        const mainDashboard = document.getElementById('mainDashboard');
        
        if (authModal && mainDashboard) {
            authModal.style.display = 'block';
            mainDashboard.style.display = 'none';
        } else {
            // Try again after a short delay
            setTimeout(showModal, 100);
        }
    };
    
    showModal();
}

// Real-time subscriptions
function startRealtimeSync() {
    if (!currentOrganization) return;
    
    // Subscribe to contacts changes
    realtimeSubscription = supabase
        .channel('contacts-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'contacts',
                filter: `id=neq.null`
            },
            async (payload) => {
                await handleRealtimeContactChange(payload);
            }
        )
        .subscribe();
    
    // Subscribe to activity log for notifications
    supabase
        .channel('activity-log')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_log',
                filter: `id=neq.null`
            },
            (payload) => {
                handleActivityNotification(payload.new);
            }
        )
        .subscribe();
    
    // Monitor connection status
    monitorConnectionStatus();
}

async function handleRealtimeContactChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    try {
        switch (eventType) {
            case 'INSERT':
                // Add new contact if it's not from current user
                if (newRecord.created_by !== window.currentUser.id) {
                    const newContact = {
                        id: newRecord.id,
                        plantName: newRecord.plant_name,
                        location: newRecord.location,
                        contactName: newRecord.contact_name,
                        phoneNumber: newRecord.phone_number,
                        emailAddress: newRecord.email_address,
                        firstContact: newRecord.first_contact,
                        recentContact: newRecord.recent_contact,
                        nextContact: newRecord.next_contact,
                        frequency: newRecord.frequency,
                        callTime: newRecord.call_time,
                        notes: newRecord.notes,
                        status: newRecord.status,
                        createdAt: newRecord.created_at,
                        updatedAt: newRecord.updated_at
                    };
                    
                    contacts.unshift(newContact);
                    showToast(`New contact added: ${newContact.plantName}`, 'info');
                }
                break;
                
            case 'UPDATE':
                // Update existing contact
                const contactIndex = contacts.findIndex(c => c.id === newRecord.id);
                if (contactIndex !== -1 && newRecord.updated_by !== window.currentUser.id) {
                    contacts[contactIndex] = {
                        id: newRecord.id,
                        plantName: newRecord.plant_name,
                        location: newRecord.location,
                        contactName: newRecord.contact_name,
                        phoneNumber: newRecord.phone_number,
                        emailAddress: newRecord.email_address,
                        firstContact: newRecord.first_contact,
                        recentContact: newRecord.recent_contact,
                        nextContact: newRecord.next_contact,
                        frequency: newRecord.frequency,
                        callTime: newRecord.call_time,
                        notes: newRecord.notes,
                        status: newRecord.status,
                        createdAt: newRecord.created_at,
                        updatedAt: newRecord.updated_at
                    };
                    
                    showToast(`Contact updated: ${contacts[contactIndex].plantName}`, 'info');
                }
                break;
                
            case 'DELETE':
                // Remove deleted contact
                const deletedIndex = contacts.findIndex(c => c.id === oldRecord.id);
                if (deletedIndex !== -1) {
                    const deletedContact = contacts[deletedIndex];
                    contacts.splice(deletedIndex, 1);
                    
                    if (oldRecord.updated_by !== window.currentUser.id) {
                        showToast(`Contact deleted: ${deletedContact.plantName}`, 'warning');
                    }
                }
                break;
        }
        
        // Update UI
        filterContacts();
        updateStats();
        
    } catch (error) {
        console.error('Real-time sync error:', error);
    }
}

function handleActivityNotification(activity) {
    if (activity.user_id === window.currentUser.id) return; // Ignore own actions
    
    // Show notification for team member activities
    const actions = {
        created: 'added a new contact',
        updated: 'updated a contact', 
        deleted: 'deleted a contact'
    };
    
    const message = `Team member ${actions[activity.action] || 'made changes'}`;
    showToast(message, 'info', 3000);
}

function monitorConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    
    // Check connection periodically, but less frequently
    setInterval(async () => {
        // Only check if page is visible to avoid unnecessary requests
        if (document.visibilityState === 'visible') {
            try {
                const { error } = await supabase
                    .from('contacts')
                    .select('id')
                    .limit(1);
                
                if (error) throw error;
                
                // Online
                statusEl.innerHTML = '<i class="fas fa-wifi"></i> <span>Online</span>';
                statusEl.className = 'connection-status online';
                
            } catch (error) {
                // Only log non-auth errors to avoid spam
                if (!error.message || (!error.message.includes('JWT') && !error.message.includes('auth'))) {
                    console.log('Connection check failed:', error);
                }
                
                // Offline
                statusEl.innerHTML = '<i class="fas fa-wifi-slash"></i> <span>Offline</span>';
                statusEl.className = 'connection-status offline';
            }
        }
    }, 30000); // Check every 30 seconds instead of 10
}

// Sharing and team management functions
async function showInviteModal() {
    document.getElementById('inviteModal').style.display = 'block';
    
    // Generate invite link
    const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${window.currentOrganization.id}`;
    document.getElementById('inviteLink').value = inviteLink;
}

async function sendInvite() {
    const email = document.getElementById('inviteEmail').value;
    const role = document.getElementById('inviteRole').value;
    
    if (!email) {
        showToast('Please enter an email address', 'error');
        return;
    }
    
    try {
        // In a real implementation, you'd send an email invitation
        // For now, we'll just show the invite link
        
        const inviteData = {
            email,
            role,
            invited_by: window.currentUser.id,
            created_at: new Date().toISOString()
        };
        
        // Store pending invitation (you'd typically use a separate table)
        localStorage.setItem(`invite_${email}`, JSON.stringify(inviteData));
        
        showToast(`Invitation sent to ${email}`, 'success');
        closeInviteModal();
        
    } catch (error) {
        console.error('Invite error:', error);
        showToast('Error sending invitation', 'error');
    }
}

function copyInviteLink() {
    const linkInput = document.getElementById('inviteLink');
    linkInput.select();
    document.execCommand('copy');
    showToast('Invite link copied!', 'success');
}

function closeInviteModal() {
    document.getElementById('inviteModal').style.display = 'none';
    document.getElementById('inviteEmail').value = '';
}

async function showSettingsModal() {
    document.getElementById('settingsModal').style.display = 'block';
    document.getElementById('orgName').value = window.currentOrganization.name;
    
    // Load team members
    await loadTeamMembers();
    
    // Load activity log
    await loadActivityLog();
}

async function loadTeamMembers() {
    try {
        const { data: members, error } = await supabase
            .from('organization_members')
            .select(`
                role,
                joined_at,
                user_profiles (
                    full_name,
                    avatar_url
                )
            `)
            .eq('organization_id', window.currentOrganization.id);
        
        if (error) throw error;
        
        const membersList = document.getElementById('teamMembersList');
        membersList.innerHTML = members.map(member => `
            <div class="team-member">
                <img src="${member.user_profiles?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.user_profiles?.full_name || 'User')}" 
                     alt="Avatar" class="member-avatar">
                <div class="member-info">
                    <strong>${member.user_profiles?.full_name || 'Unknown'}</strong>
                    <span class="member-role">${member.role}</span>
                </div>
                <span class="member-joined">Joined ${new Date(member.joined_at).toLocaleDateString()}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load team members error:', error);
    }
}

async function loadActivityLog() {
    try {
        const { data: activities, error } = await supabase
            .from('activity_log')
            .select(`
                action,
                created_at,
                user_profiles (
                    full_name
                ),
                contacts (
                    plant_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        const activityLog = document.getElementById('activityLog');
        activityLog.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-info">
                    <strong>${activity.user_profiles?.full_name || 'Someone'}</strong>
                    ${activity.action} 
                    <strong>${activity.contacts?.plant_name || 'a contact'}</strong>
                </div>
                <span class="activity-time">${new Date(activity.created_at).toLocaleString()}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load activity log error:', error);
    }
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

// Set up auth form handler
document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
});