# ZKTeco K40 Real-Time Attendance Integration

This module provides real-time attendance tracking from ZKTeco K40 biometric device.

## Features

- **Real-time attendance**: Listens for punches as they happen (0.5 second notification)
- **WebSocket notifications**: Frontend receives instant "Arif Checked In" notifications
- **Automatic reconnection**: Reconnects to device if connection drops
- **API endpoints**: Sync device time, download history, view registered users
- **Dual attendance tables**: 
  - `real_time_logs`: Raw punch data from device
  - `attendance`: Daily summary (in_time, out_time)

## Hardware Setup Required

### 1. K40 Device Configuration

1. **Set Static IP** on K40:
   - Menu → Comm. → Ethernet → Set IP (default: `192.168.1.201`)
   - Subnet: `255.255.255.0`
   - Gateway: Your router IP

2. **Verify Port 4370**:
   - Default communication port for ZKTeco devices
   - Menu → Comm. → Device Settings

3. **Ensure No Password**:
   - Communication password should be `0` (default)
   - Menu → Comm. → Password

4. **Connect Device to Network**:
   - Use Ethernet cable
   - Ensure same network as your server

### 2. Server Network Configuration

**Windows Firewall (XAMPP users):**
```powershell
# Open PowerShell as Administrator and run:
netsh advfirewall firewall add rule name="ZKTeco K40" dir=in action=allow protocol=tcp localport=4370
```

**Test Connection:**
```powershell
ping 192.168.1.201
```

## Environment Variables

Add to `.env`:
```env
# ZKTeco K40 Device Configuration
ZKTeco_IP=192.168.1.201
ZKTeco_PORT=4370
ZKTeco_TIMEOUT=5000
ZKTeco_AUTO_CONNECT=true
```

## Database Tables

### real_time_logs
Stores every punch as it happens:
```sql
- device_user_id: ZKTeco user ID (e.g., '101')
- emp_code: Matched employee code from employees table
- employee_name: Employee name
- punch_time: Full timestamp
- verify_type: 'Fingerprint', 'Card', etc.
- status: 'CheckIn' or 'CheckOut'
- device_ip: IP of the device
- processed: Flag for batch processing
```

### attendance (updated automatically)
Daily summary per employee:
```sql
- emp_id: Employee code
- day, month, year: Date
- status: 'P' (Present) or 'A' (Absent)
- in_time: First punch of the day
- out_time: Last punch of the day
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/zkteco/status` | Connection status |
| POST | `/api/zkteco/connect` | Connect to device |
| DELETE | `/api/zkteco/disconnect` | Disconnect from device |
| GET | `/api/zkteco/users` | List users on device |
| GET | `/api/zkteco/attendance?startDate=2026-04-01&endDate=2026-04-30` | Download history |
| POST | `/api/zkteco/sync-time` | Sync device clock |

## WebSocket Events

Connect to: `ws://localhost:3001/attendance`

### Client → Server
```javascript
// Subscribe to real-time attendance
socket.emit('subscribe_attendance');

// Get current device status
socket.emit('get_device_status');
```

### Server → Client
```javascript
// New attendance punch
socket.on('new_attendance', (data) => {
  console.log(data);
  // {
  //   type: 'attendance',
  //   employee: 'John Doe',
  //   empCode: 'EMP001',
  //   time: '2026-04-12 13:05:00',
  //   status: 'CheckIn',
  //   verifyType: 'Fingerprint'
  // }
});

// Device connection status change
socket.on('device_connection_status', (data) => {
  console.log(data.connected); // true/false
});
```

## Employee Mapping

The system matches device `userId` to employees by:
1. `employees.emp_id` = device user ID
2. OR `employees.punch_card` = device user ID

**To link an employee:**
```sql
UPDATE employees 
SET emp_id = '101'  -- The user ID from ZKTeco device
WHERE emp_code = 'EMP001';
```

## Frontend Integration Example

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/attendance');

// Subscribe to updates
socket.emit('subscribe_attendance');

// Listen for new punches
socket.on('new_attendance', (data) => {
  // Show toast notification
  toast.success(`${data.employee} ${data.status === 'CheckIn' ? 'checked in' : 'checked out'} at ${data.time}`);
  
  // Refresh attendance table
  refreshAttendanceTable();
});

// Monitor device connection
socket.on('device_connection_status', (data) => {
  setDeviceConnected(data.connected);
});
```

## Troubleshooting

### "Cannot connect to device"
1. Ping the device: `ping 192.168.1.201`
2. Check firewall port 4370 is open
3. Verify device IP matches `.env` ZKTeco_IP
4. Ensure device and server are on same network

### "SDK not available" warning
The SDK loads dynamically. This warning appears if:
- `npm install zkteco-js` wasn't run
- Module loading failed

### Real-time logs not appearing
1. Check console for connection messages
2. Verify employee has matching `emp_id` or `punch_card`
3. Check `real_time_logs` table in MySQL

## Architecture

```
┌─────────────┐     TCP 4370     ┌─────────────┐
│  ZKTeco K40 │◄────────────────►│   NestJS    │
│  (Device)   │   zkteco-js SDK  │   Service   │
└─────────────┘                  └──────┬──────┘
       │                              │
       │ Fingerprint                  │ WebSocket
       │ Scan                        │
       ▼                              ▼
┌─────────────┐               ┌─────────────┐
│  Real-time  │──────────────►│   Frontend  │
│   Logs DB   │   WS Emit     │  (Toast UI) │
└─────────────┘               └─────────────┘
```

## Why This Is Better Than CSV

| Feature | CSV Upload | Real-time |
|---------|-----------|-----------|
| Speed | Manual (end of day) | Instant (0.5s) |
| Automation | None | Fully automatic |
| Data Loss Risk | Thumb drive can be lost | Direct to database |
| Notifications | None | Instant WebSocket alerts |
| History Download | Manual | API available |

## Testing Without Hardware

If you don't have the K40 connected, the service will:
1. Log "⚠️ zkteco-js not available" or connection errors
2. Continue running other API features
3. Mock mode available for UI development
