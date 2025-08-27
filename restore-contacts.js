// RESTORE ALL CONTACTS SCRIPT
// Copy and paste this entire script into your browser console (F12 → Console)

const contacts = [
  {
    plantName: "EBCO Metal Finishing, LTD",
    location: "BC", 
    contactName: "Will & Mary",
    firstContact: "2024-09-10",
    recentContact: "2025-07-14", 
    nextContact: "2025-09-08", // September 2nd Week
    frequency: "2-3 months",
    callTime: "",
    phoneNumber: "",
    notes: "didn't win bet, next material probably sept - Oct"
  },
  {
    plantName: "Armour Galvanizing",
    location: "",
    contactName: "Gloria", 
    firstContact: "",
    recentContact: "2025-08-19",
    nextContact: "2025-09-19",
    frequency: "2-3 months",
    callTime: "",
    phoneNumber: "",
    notes: "Material Not ready yet she said she will reach out once ready"
  },
  {
    plantName: "Sureway Group Galvanizing",
    location: "",
    contactName: "Bill",
    firstContact: "2024-11-12",
    recentContact: "",
    nextContact: "2025-08-25", 
    frequency: "2-3 months",
    callTime: "",
    phoneNumber: "",
    notes: "No reply from Bill"
  },
  {
    plantName: "Ancrages Québec",
    location: "QC",
    contactName: "",
    firstContact: "",
    recentContact: "",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: ""
  },
  {
    plantName: "AZZ Galvanizing", 
    location: "",
    contactName: "Andrew",
    firstContact: "2024-09-04",
    recentContact: "2025-04-23",
    nextContact: "2026-02-01", // 1st week of Feb, 2026
    frequency: "Yearly Bid",
    callTime: "",
    phoneNumber: "",
    notes: "Did not win bid for 2025, will submit again In 2026 including USA"
  },
  {
    plantName: "Canadian Galvanizing",
    location: "",
    contactName: "Chris",
    firstContact: "2024-08-29", 
    recentContact: "2025-07-02",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: "Reached out multiple times ans submitted pricing, did not show interest"
  },
  {
    plantName: "Cascadia Metal",
    location: "",
    contactName: "Alicia, Bill",
    firstContact: "2025-04-22",
    recentContact: "2025-07-30",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: "Multiple emails sent, did not receive a reply"
  },
  {
    plantName: "Corbec",
    location: "",
    contactName: "",
    firstContact: "",
    recentContact: "",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: ""
  },
  {
    plantName: "Court Galvanizing Limited",
    location: "",
    contactName: "Dillon",
    firstContact: "2025-06-30",
    recentContact: "2025-07-04", 
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: "Correspondence though email, quote submitted, did not get a reply back"
  },
  {
    plantName: "DomCast Components and Assemblies Inc.",
    location: "",
    contactName: "",
    firstContact: "",
    recentContact: "",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: ""
  },
  {
    plantName: "Dynamix",
    location: "",
    contactName: "",
    firstContact: "",
    recentContact: "",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: ""
  },
  {
    plantName: "Falcon Galvanizing Ltd",
    location: "",
    contactName: "Marc",
    firstContact: "2024-10-17",
    recentContact: "2024-12-04",
    nextContact: "2025-08-20",
    frequency: "",
    callTime: "",
    phoneNumber: "204 927 7016",
    notes: "Mark said on call to write him an email stating the info, no reply after that"
  },
  {
    plantName: "Galvanisation Quebec - Princeville",
    location: "QC",
    contactName: "",
    firstContact: "",
    recentContact: "2024-11-26",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "819-505-4440",
    notes: "Corbec is their long term contract"
  },
  {
    plantName: "K trail Galvanizing",
    location: "QC",
    contactName: "",
    firstContact: "2024-08-30",
    recentContact: "2024-11-26",
    nextContact: "2024-12-02",
    frequency: "",
    callTime: "",
    phoneNumber: "418-248-7018",
    notes: "Maxim Row is contact for handling zinc byproducts-> Didn't pick phone"
  },
  {
    plantName: "Nord-Est Métal",
    location: "QC",
    contactName: "",
    firstContact: "",
    recentContact: "2024-12-02",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "(514) 648-9494",
    notes: ""
  },
  {
    plantName: "Norgalv Limited (Sandvik)",
    location: "",
    contactName: "Charl",
    firstContact: "2024-10-17",
    recentContact: "2024-10-28",
    nextContact: "2025-01-06", // 2nd week of Jan
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: "They want to stay with their current supply chain"
  },
  {
    plantName: "Red River Galvanizing",
    location: "MB",
    contactName: "",
    firstContact: "",
    recentContact: "2024-11-26",
    nextContact: "2025-01-06", // 2nd week of Jan
    frequency: "",
    callTime: "",
    phoneNumber: "204-889-1861, 780-236-4258",
    notes: "Wayne said that they have a steady person whoo buys product from states"
  },
  {
    plantName: "Silver City Galvanizing, Inc.",
    location: "BC",
    contactName: "",
    firstContact: "2024-10-17",
    recentContact: "2024-11-14",
    nextContact: "2025-01-01", // 1st week of Jan
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: "They have a long term contract with someone"
  },
  {
    plantName: "Nord-Est Métal",
    location: "",
    contactName: "Darcy",
    firstContact: "2024-10-31",
    recentContact: "2024-11-20",
    nextContact: "2024-12-02",
    frequency: "1 month",
    callTime: "",
    phoneNumber: "",
    notes: "Went to office in ontario, asked to provide us material pics and MSDS, no response yet"
  },
  {
    plantName: "Sunaar Steel Tube and Galvanizing Inc.",
    location: "ON",
    contactName: "",
    firstContact: "2024-10-17",
    recentContact: "2024-11-26",
    nextContact: "2024-12-05",
    frequency: "",
    callTime: "11:00",
    phoneNumber: "-22052",
    notes: "Contacted sales team, no response through email-> Didn't pick phone"
  },
  {
    plantName: "Supreme Galvanizing, Ltd.",
    location: "",
    contactName: "",
    firstContact: "",
    recentContact: "2024-11-07",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: ""
  },
  {
    plantName: "Valmont Coatings - Pure Metal Galvanizing",
    location: "",
    contactName: "",
    firstContact: "",
    recentContact: "2024-11-26",
    nextContact: "2024-12-02",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: "Plant manager asked to contact mississauga corporate branch, jmiceli@velmont.com"
  },
  {
    plantName: "Tlirr Group",
    location: "USA",
    contactName: "Bob Olsen",
    firstContact: "2024-11-06",
    recentContact: "2024-11-06",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: "This is in states, rno@tlirr.com"
  },
  {
    plantName: "Global Metal",
    location: "QC",
    contactName: "Jeff Solomon, Jonathan Schacter",
    firstContact: "",
    recentContact: "",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: ""
  },
  {
    plantName: "John Ross",
    location: "",
    contactName: "",
    firstContact: "",
    recentContact: "2025-07-30",
    nextContact: "2025-11-03", // 2nd week of November, 2025
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: ""
  },
  {
    plantName: "Nyrstar",
    location: "USA",
    contactName: "",
    firstContact: "",
    recentContact: "",
    nextContact: "",
    frequency: "",
    callTime: "",
    phoneNumber: "",
    notes: ""
  }
];

console.log('🚀 Starting to restore', contacts.length, 'contacts...');

// Add contacts one by one
async function restoreAllContacts() {
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    if (!contact.plantName) continue; // Skip empty rows
    
    try {
      console.log(`Adding contact ${i+1}: ${contact.plantName}`);
      
      // Use the existing save function
      await saveContactToSupabase({
        ...contact,
        status: 'active'
      });
      
      // Wait a bit between contacts to avoid overwhelming the database  
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Failed to add ${contact.plantName}:`, error);
    }
  }
  
  console.log('✅ All contacts restored! Refreshing page...');
  setTimeout(() => location.reload(), 1000);
}

// Start the restoration
restoreAllContacts();