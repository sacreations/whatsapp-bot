# Simple UI for WhatsApp Bot

A lightweight, minimal interface for managing WhatsApp Bot settings and viewing saved status updates.

## Features

### Settings Management
- **Quick Toggles**: Enable/disable core features with simple switches
  - Auto Reply
  - Social Media Download
  - Auto Status View
  - Hide Online Status
  - Disable Read Receipts
  - Pause Bot

- **Basic Configuration**
  - Command Prefix
  - Bot Name
  - Owner Number

### Status Viewer
- View all saved status updates from contacts
- Filter by type (images/videos)
- Filter by time period (24h, 7d, 30d, all time)
- Preview, download, or delete status files
- Contact information display

## Usage

### Starting the Simple UI Server

1. **Standalone Mode**:
   ```bash
   cd simple-ui
   node server.js
   ```
   Access at: http://localhost:3001

2. **Integrated Mode** (recommended):
   The simple UI server can be started along with the main bot. Add this to your main bot startup:
   ```javascript
   import { startSimpleServer } from './simple-ui/server.js';
   startSimpleServer();
   ```

### Accessing the Interface

1. Open your web browser
2. Navigate to `http://localhost:3001`
3. Use the tabs to switch between Settings and Status view

## Configuration

The simple UI automatically reads from and writes to your `config.env` file. Changes made through the interface will:

1. Update the configuration file immediately
2. Be applied to the bot (some settings may require restart)
3. Be saved locally in the browser as backup

## Status Management

The interface shows saved status updates from the `downloads/statuses/` directory. You can:

- **View**: Click to open status in a new tab
- **Download**: Save status file to your device
- **Delete**: Remove status file from the server

## File Structure

```
simple-ui/
├── index.html          # Main interface
├── style.css           # Styling and responsive design
├── script.js           # Frontend functionality
├── server.js           # Backend API server
└── README.md           # This file
```

## API Endpoints

The simple UI provides these API endpoints:

- `GET /api/config` - Get current configuration
- `POST /api/config` - Update configuration
- `GET /api/statuses` - Get saved status list
- `GET /api/statuses/:filename` - Serve status file
- `DELETE /api/statuses/:filename` - Delete status file

## Browser Compatibility

- Modern browsers with ES6+ support
- Mobile responsive design
- Works offline with cached settings

## Development

To modify the simple UI:

1. Edit the HTML, CSS, or JavaScript files
2. Restart the server if you changed `server.js`
3. Refresh the browser to see changes

## Differences from Admin Panel

The simple UI is designed to be:

- **Lightweight**: Minimal dependencies and resources
- **Fast**: Quick loading and responsive interface
- **Focused**: Only essential settings and status viewing
- **Easy**: No complex navigation or overwhelming options

## Environment Variables

- `SIMPLE_UI_PORT`: Port for the simple UI server (default: 3001)

## Security Note

This simple UI is intended for local use. If exposing to a network:

1. Consider adding authentication
2. Use HTTPS in production
3. Implement rate limiting
4. Validate all inputs server-side

## Troubleshooting

### Common Issues

1. **Port already in use**: Change `SIMPLE_UI_PORT` in environment
2. **Config not loading**: Check `config.env` file exists and is readable
3. **Status not showing**: Verify `downloads/statuses/` directory exists
4. **Changes not saving**: Check file permissions on `config.env`

### Logs

Server logs will show:
- Configuration updates
- File operations
- Error messages
- API requests

Check the console for frontend errors and server terminal for backend issues.
