import config from "../../Config.js";

const commands = [];

/**
 * Register a command
 * @param {Object} command - Command configuration
 * @param {Function} handler - Command handler function
 */
export const bot = (command, handler) => {
    const pattern = typeof command.pattern === 'string' ? command.pattern.toLowerCase() : command.pattern;
    const commandObj = { ...command, pattern, handler };
    
    // Replace existing command with same pattern
    const existingCommandIndex = commands.findIndex(cmd => 
        (typeof cmd.pattern === 'string' && cmd.pattern === pattern) || 
        (cmd.pattern instanceof RegExp && cmd.pattern.toString() === commandObj.pattern.toString())
    );
    
    if (existingCommandIndex !== -1) {
        commands.splice(existingCommandIndex, 1);
    }
    
    commands.push(commandObj);
};

/**
 * Handle incoming message and check for commands
 * @param {Object} m - Message object
 * @param {Object} sock - Socket connection
 */
export const handleMessage = async (m, sock) => {
    // Get message text from various message types
    const msg = (m.message?.conversation || 
                 m.message?.extendedTextMessage?.text || 
                 m.message?.imageMessage?.caption ||
                 m.message?.videoMessage?.caption || "").trim();
    
    // Check if message starts with command prefix
    if (!msg || !msg.startsWith(config.PREFIX)) return false;
    
    // Extract command name and arguments
    const cmdPart = msg.slice(config.PREFIX.length).trim();
    const cmdSplit = cmdPart.split(' ');
    const cmdName = cmdSplit[0].toLowerCase();
    const cmdArgs = cmdSplit.slice(1).join(' ');
    
    // Find matching command
    let matched = false;
    
    for (const cmd of commands) {
        if (typeof cmd.pattern === 'string') {
            // String pattern matching
            if (cmd.pattern === cmdName) {
                if (cmd.fromMe && !m.key.fromMe) continue;
                
                try {
                    await cmd.handler(m, sock, cmdArgs);
                    matched = true;
                    break;
                } catch (error) {
                    console.error(`Error executing command ${cmd.pattern}:`, error);
                }
            }
        } else if (cmd.pattern instanceof RegExp) {
            // Regex pattern matching
            const match = msg.slice(config.PREFIX.length).match(cmd.pattern);
            if (match) {
                if (cmd.fromMe && !m.key.fromMe) continue;
                
                try {
                    await cmd.handler(m, sock, match);
                    matched = true;
                    break;
                } catch (error) {
                    console.error(`Error executing regex command ${cmd.pattern}:`, error);
                }
            }
        }
    }
    
    return matched;
};

/**
 * Get list of all registered commands
 */
export const listCommands = () => commands;
