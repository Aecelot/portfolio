# LLM Network Access Setup Guide

This guide explains how to access your local LLM (LlamaCPP) from other computers on your home network.

## Quick Start

1. **Configure for Network Access**
    - Open `config/env.local`
    - Change `LLM_HOST=127.0.0.1` to `LLM_HOST=0.0.0.0`
    - Save the file

2. **Restart the Server**
    ```powershell
    .\scripts\stop-llama-server.ps1
    .\start-llama-server.ps1
    ```

3. **Find Your Local IP**
    ```powershell
    ipconfig
    ```
    Look for your WiFi adapter's IPv4 address (e.g., `192.168.1.100`)

4. **Access from Other Computers**
    ```
    http://[YOUR_IP_ADDRESS]:8080
    ```

## Detailed Setup Instructions

### Step 1: Network Configuration

The server needs to bind to all network interfaces instead of just localhost:

```diff
- LLM_HOST=127.0.0.1
+ LLM_HOST=0.0.0.0
```

This change allows the server to accept connections from any device on your network.

### Step 2: Firewall Configuration (Optional)

Windows Firewall should automatically allow the connection, but you can verify:

1. Open Windows Defender Firewall
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Ensure the port 8080 is allowed for private networks

### Step 3: Finding Your Local IP Address

Run this command on the computer running LlamaCPP:

```powershell
ipconfig
```

Look for the "IPv4 Address" under your WiFi adapter. Common formats:
- `192.168.1.xxx` (most common for home networks)
- `10.0.0.xxx` (some routers)
- `172.16.0.xxx` (less common)

### Step 4: Testing Network Access

1. **From the server computer:**
    ```powershell
    curl http://localhost:8080/api/v1/model
    ```

2. **From another computer on the same network:**
    ```powershell
    curl http://[SERVER_IP]:8080/api/v1/model
    ```

Both should return the same model information.

## Troubleshooting

### Connection Refused

- Ensure the server is running: `.\start-llama-server.ps1`
- Verify the IP address is correct
- Check Windows Firewall settings
- Make sure both computers are on the same WiFi network

### Server Not Starting

- Check if another service is using port 8080:
   ```powershell
   netstat -ano | findstr :8080
   ```
- Free up the port if needed:
   ```powershell
   netstat -ano | findstr :8080 | ForEach-Object { $_.Split()[-1] } | Select-Object -Unique | ForEach-Object { taskkill /PID $_ /F }
   ```

### Performance Considerations

- **Network Speed**: WiFi speed affects response times
- **Concurrent Users**: Multiple users may slow down responses
- **Model Size**: Larger models use more RAM and processing power
- **Context Size**: Higher context settings use more resources

## Security Considerations

⚠️ **Important Security Notes:**

- **Network Only**: `0.0.0.0` only allows access within your local network, not from the internet
- **No Authentication**: The server has no built-in authentication
- **Consider Access Control**: Only share with trusted devices
- **Firewall Rules**: Consider restricting access to specific IP ranges

## Advanced Configuration

### Custom Port

To use a different port, modify `config/env.local`:

```diff
- LLM_PORT=8080
+ LLM_PORT=7860
```

Then access with: `http://[SERVER_IP]:7860`

### Multiple Network Interfaces

If your computer has multiple network adapters, you can specify which one to use:

```diff
- LLM_HOST=0.0.0.0
+ LLM_HOST=192.168.1.100
```

Replace `192.168.1.100` with your preferred network interface IP.

## API Usage Examples

### From Python

```python
import requests

SERVER_IP = "192.168.1.100"  # Replace with your server IP
response = requests.post(f"http://{SERVER_IP}:8080/api/v1/generate",
    json={
        "prompt": "Hello, how are you?",
        "max_tokens": 100,
        "temperature": 0.7
    })
print(response.json())
```

### From JavaScript

```javascript
const SERVER_IP = "192.168.1.100"; // Replace with your server IP

fetch(`http://${SERVER_IP}:8080/api/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        prompt: "Hello, how are you?",
        max_tokens: 100,
        temperature: 0.7
    })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Monitoring and Logs

- Server logs are displayed in the terminal where you ran `start-llama-server.ps1`
- Monitor resource usage with Task Manager
- Check active connections: `netstat -ano | findstr :8080`

## Support

If you encounter issues:

1. Verify both computers are on the same WiFi network
2. Check Windows Firewall settings
3. Ensure no other service is using port 8080
4. Try accessing from the server computer first: `http://localhost:8080`
5. Check the server logs for error messages

---

**Last Updated**: $(Get-Date -Format "yyyy-MM-dd")
**Server Version**: LlamaCPP
**Default Port**: 8080