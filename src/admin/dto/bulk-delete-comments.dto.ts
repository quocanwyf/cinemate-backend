import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize } from 'class-validator';

export class BulkDeleteCommentsDto {
  @ApiProperty({
    description: 'Array of comment IDs to delete',
    example: ['cmi7hsqfy0001vutc3xy1fhue', 'cmi7j45c90001vulw43j4fzt7'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Must provide at least one comment ID' })
  commentIds: string[];
}
