import { All, Controller, ForbiddenException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from './public.decorator';

@ApiExcludeController()
@Controller()
export class UnknownRouteController {
  @All('*path')
  @Public()
  denegar(): never {
    throw new ForbiddenException('Acceso denegado');
  }
}
