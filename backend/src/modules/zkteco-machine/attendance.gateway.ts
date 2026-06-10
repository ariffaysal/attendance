import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

// Simple CORS configuration - adjust based on your frontend URL
@WebSocketGateway({
  cors: {
    origin: '*', // In production, set this to your frontend URL
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/attendance',
})
export class AttendanceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AttendanceGateway');

  constructor() {}   

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Subscribe to real-time attendance updates
   * Client should emit: { event: 'subscribe_attendance' }
   */
  @SubscribeMessage('subscribe_attendance')
  handleSubscribeAttendance(client: Socket, payload: any): void {
    this.logger.log(`Client ${client.id} subscribed to attendance updates`);
    client.join('attendance_updates');
    client.emit('subscribed', { channel: 'attendance_updates', success: true });
  }

  /**
   * Unsubscribe from attendance updates
   */
  @SubscribeMessage('unsubscribe_attendance')
  handleUnsubscribeAttendance(client: Socket, payload: any): void {
    this.logger.log(`Client ${client.id} unsubscribed from attendance updates`);
    client.leave('attendance_updates');
    client.emit('unsubscribed', { channel: 'attendance_updates', success: true });
  }

  /**
   * Emit attendance event to all subscribed clients
   * This is called by the ZktecoMachineService when a new punch is detected
   */
  emitAttendance(eventData: {
    type: string;
    employee: string;
    empCode: string;
    time: string;
    status: string;
    verifyType: string;
  }): void {
    this.server.to('attendance_updates').emit('new_attendance', eventData);
    this.logger.log(`Emitted attendance event: ${eventData.employee} - ${eventData.status}`);
  }

  /**
   * Broadcast connection status changes
   */
  emitConnectionStatus(status: { connected: boolean; deviceInfo: any }): void {
    this.server.to('attendance_updates').emit('device_connection_status', status);
  }
}
