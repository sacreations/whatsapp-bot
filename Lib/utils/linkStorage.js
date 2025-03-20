import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to saved links file
const dataDir = path.join(__dirname, '..', '..', 'data');
const linksFilePath = path.join(dataDir, 'saved_links.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize links file if it doesn't exist
if (!fs.existsSync(linksFilePath)) {
    fs.writeFileSync(linksFilePath, JSON.stringify({ links: [] }));
}

/**
 * Load saved links from file
 * @returns {Array} Array of saved link objects
 */
export function loadSavedLinks() {
    try {
        const data = fs.readFileSync(linksFilePath, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed.links) ? parsed.links : [];
    } catch (error) {
        console.error('Error loading saved links:', error);
        return [];
    }
}

/**
 * Save link to database
 * @param {Object} linkData - Link data object
 * @returns {boolean} Success status
 */
export function saveLink(linkData) {
    try {
        // Required fields
        if (!linkData.url || !linkData.platform || !linkData.sender || !linkData.groupId) {
            throw new Error('Missing required link data');
        }
        
        // Add timestamp if not provided
        if (!linkData.timestamp) {
            linkData.timestamp = Date.now();
        }
        
        // Load current links
        const links = loadSavedLinks();
        
        // Check if link already exists
        const exists = links.some(link => 
            link.url === linkData.url && 
            link.groupId === linkData.groupId
        );
        
        if (exists) {
            console.log('Link already saved:', linkData.url);
            return false;
        }
        
        // Add new link
        links.push(linkData);
        
        // Save back to file
        fs.writeFileSync(linksFilePath, JSON.stringify({ links }, null, 2));
        
        console.log('Link saved successfully:', linkData.url);
        return true;
    } catch (error) {
        console.error('Error saving link:', error);
        return false;
    }
}

/**
 * Delete a link by ID
 * @param {string} id - Link ID (url)
 * @returns {boolean} Success status
 */
export function deleteLink(id) {
    try {
        // Load current links
        const links = loadSavedLinks();
        
        // Filter out the link to delete
        const newLinks = links.filter(link => link.url !== id);
        
        // If no links were removed, the ID wasn't found
        if (newLinks.length === links.length) {
            return false;
        }
        
        // Save back to file
        fs.writeFileSync(linksFilePath, JSON.stringify({ links: newLinks }, null, 2));
        
        console.log('Link deleted successfully:', id);
        return true;
    } catch (error) {
        console.error('Error deleting link:', error);
        return false;
    }
}

/**
 * Get links for a specific group
 * @param {string} groupId - Group ID
 * @returns {Array} Array of links for the group
 */
export function getGroupLinks(groupId) {
    try {
        const links = loadSavedLinks();
        return links.filter(link => link.groupId === groupId);
    } catch (error) {
        console.error('Error getting group links:', error);
        return [];
    }
}

/**
 * Delete all links for a group
 * @param {string} groupId - Group ID
 * @returns {number} Number of links deleted
 */
export function clearGroupLinks(groupId) {
    try {
        // Load current links
        const links = loadSavedLinks();
        
        // Count links for the group
        const groupLinks = links.filter(link => link.groupId === groupId);
        const count = groupLinks.length;
        
        // Filter out links for the group
        const newLinks = links.filter(link => link.groupId !== groupId);
        
        // Save back to file
        fs.writeFileSync(linksFilePath, JSON.stringify({ links: newLinks }, null, 2));
        
        console.log(`Cleared ${count} links for group:`, groupId);
        return count;
    } catch (error) {
        console.error('Error clearing group links:', error);
        return 0;
    }
}
