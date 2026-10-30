import { Module } from '@nestjs/common';
import { UnknownRouteController } from './unknown-route.controller';

@Module({
  controllers: [UnknownRouteController],
})
export class UnknownRouteModule {}
