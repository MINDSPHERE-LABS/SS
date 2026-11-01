import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { RelayService } from './relay.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [RelayService],
  exports: [RelayService],
})
export class AppModule {}

