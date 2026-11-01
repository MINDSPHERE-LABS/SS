import { Controller, Get, Inject } from '@nestjs/common';
import { RelayService } from './relay.service';

@Controller('api')
export class AppController {
  constructor(@Inject(RelayService) private readonly relayService: RelayService) {}

  @Get('status')
  getStatus() {
    return {
      status: 'online',
      serverTime: new Date().toISOString(),
      sessions: this.relayService.getAllSessions(),
    };
  }

  @Get('sessions')
  getSessions() {
    return this.relayService.getAllSessions();
  }
}

