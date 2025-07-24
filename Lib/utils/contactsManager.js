import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to custom contacts file
const contactsPath = path.join(__dirname, '..', '..', 'data', 'custom-contacts.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Load custom contacts from file
 * @returns {Object} Custom contacts object
 */
export async function loadCustomContacts() {
    try {
        // Create empty contacts file if it doesn't exist
        if (!fs.existsSync(contactsPath)) {
            fs.writeFileSync(contactsPath, JSON.stringify({}));
            return {};
        }
        
        // Read and parse the contacts file
        const data = fs.readFileSync(contactsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading custom contacts:', error);
        return {};
    }
}

/**
 * Save a custom contact
 * @param {string} number - Phone number
 * @param {string} name - Contact name
 * @param {string} [id] - Optional ID for updating existing contact
 * @returns {Object} The saved contact
 */
export async function saveCustomContact(number, name, id = null) {
    try {
        // Clean the phone number
        const cleanNumber = number.replace(/[^0-9]/g, '');
        
        // Load current contacts
        const contacts = await loadCustomContacts();
        
        // If updating existing contact
        if (id) {
            let updated = false;
            
            // Find the contact by ID and update it
            for (const [key, value] of Object.entries(contacts)) {
                if (value.id === id) {
                    // If number changed, delete old entry and create new one
                    if (key !== cleanNumber) {
                        delete contacts[key];
                    }
                    
                    contacts[cleanNumber] = {
                        name,
                        id,
                        updatedAt: new Date().toISOString()
                    };
                    
                    updated = true;
                    break;
                }
            }
            
            if (!updated) {
                throw new Error('Contact not found');
            }
        } else {
            // Create a new contact
            // Generate a UUID for the new contact
            const newId = uuidv4();
            
            contacts[cleanNumber] = {
                name,
                id: newId,
                createdAt: new Date().toISOString()
            };
        }
        
        // Write back to file
        fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
        
        return contacts[cleanNumber];
    } catch (error) {
        console.error('Error saving custom contact:', error);
        throw error;
    }
}

/**
 * Delete a custom contact by ID
 * @param {string} id - Contact ID
 * @returns {boolean} True if contact was deleted, false otherwise
 */
export async function deleteCustomContact(id) {
    try {
        // Load current contacts
        const contacts = await loadCustomContacts();
        
        let deleted = false;
        
        // Find the contact by ID and delete it
        for (const [key, value] of Object.entries(contacts)) {
            if (value.id === id) {
                delete contacts[key];
                deleted = true;
                break;
            }
        }
        
        // Write back to file if a contact was deleted
        if (deleted) {
            fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
        }
        
        return deleted;
    } catch (error) {
        console.error('Error deleting custom contact:', error);
        throw error;
    }
}

/**
 * Format contacts for API response
 * @param {Object} contacts - Contacts object from file
 * @returns {Array} Formatted contacts array
 */
export function formatContactsForApi(contacts) {
    return Object.entries(contacts).map(([number, data]) => ({
        id: data.id,
        number,
        name: data.name,
        createdAt: data.createdAt || data.updatedAt,
        updatedAt: data.updatedAt
    }));
}

/**
 * Find a contact name by phone number
 * @param {string} number - Phone number
 * @returns {string|null} Contact name or null if not found
 */
export async function findContactNameByNumber(number) {
    try {
        // Clean the phone number
        const cleanNumber = number.replace(/[^0-9]/g, '');
        
        // Load contacts
        const contacts = await loadCustomContacts();
        
        // Check if the number exists in contacts
        if (contacts[cleanNumber]) {
            return contacts[cleanNumber].name;
        }
        
        // Check if the number with WhatsApp suffix exists
        const suffixedNumber = `${cleanNumber}@s.whatsapp.net`;
        if (contacts[suffixedNumber]) {
            return contacts[suffixedNumber].name;
        }
        
        return null;
    } catch (error) {
        console.error('Error finding contact name:', error);
        return null;
    }
}

/**
 * Get a contact by JID or number
 * @param {string} id - JID or phone number
 * @returns {Object|null} Contact object or null if not found
 */
export async function getContact(id) {
    try {
        // Extract the number part if it's a JID
        const number = id.includes('@') ? id.split('@')[0] : id;
        
        // Load contacts
        const contacts = await loadCustomContacts();
        
        // Check direct matches
        if (contacts[id]) {
            return {
                ...contacts[id],
                number: id
            };
        }
        
        if (contacts[number]) {
            return {
                ...contacts[number],
                number
            };
        }
        
        // Check for the number with WhatsApp suffix
        const suffixedNumber = `${number}@s.whatsapp.net`;
        if (contacts[suffixedNumber]) {
            return {
                ...contacts[suffixedNumber],
                number: suffixedNumber
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error getting contact:', error);
        return null;
    }
}

