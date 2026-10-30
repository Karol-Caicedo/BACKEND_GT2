import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform, plainToInstance } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested, ArrayMinSize } from 'class-validator';

export class ItemRespuestaDto {
  @ApiProperty({ example: '123e4567-e89b-42d3-a456-426614174000' })
  @IsUUID('4', { message: 'temaId inválido' })
  temaId: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt({ message: 'El puntaje debe ser entero de 1 a 5' })
  @Min(1)
  @Max(5)
  puntaje?: number;
}

export class CrearEncuestaDto {
  @ApiProperty({
    type: [ItemRespuestaDto],
    example: [
      { temaId: '123e4567-e89b-42d3-a456-426614174000', puntaje: 5 },
      { temaId: '123e4567-e89b-42d3-a456-426614174001', puntaje: 4 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe elegir al menos 1 tema' })
  @ValidateNested({ each: true })
  @Type(() => ItemRespuestaDto)
  @Transform(
    ({ value }) => {
      const arr = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(arr) ? arr.map((i) => plainToInstance(ItemRespuestaDto, i)) : arr;
    },
    { toClassOnly: true },
  )
  items: ItemRespuestaDto[];
}
