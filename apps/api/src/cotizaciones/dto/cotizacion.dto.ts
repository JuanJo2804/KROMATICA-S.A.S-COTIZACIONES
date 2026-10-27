import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { EstadoCotizacion, FuenteTiempo, TipoCorte } from '../../generated/prisma/enums.js';

export class ItemDto {
  @ApiProperty({ example: 'Argolla' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 60 })
  @IsNumber()
  @Min(0)
  valor: number;
}

export class ConceptoAdicionalDto {
  @ApiProperty({ example: 'samblasted' })
  @IsString()
  codigo: string;

  @ApiProperty({ example: 'Samblasted' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Costo por cada unidad' })
  @IsOptional()
  @IsNumber()
  porUnidad?: number;

  @ApiPropertyOptional({ description: 'Costo único que se reparte entre todas las unidades', example: 15000 })
  @IsOptional()
  @IsNumber()
  fijo?: number;
}

export class CliseDto {
  @ApiProperty({ example: 224 })
  @IsNumber()
  @Min(0)
  cm2: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  cantidadClises: number;

  @ApiPropertyOptional({ description: 'Si no se envía, se usa el parámetro vigente PRECIO_CM2_CLISE' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioCm2?: number;

  @ApiPropertyOptional({ description: 'Espacio entre unidades (cm). Solo informativo: cm2 ya viene calculado.', example: 0.3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  espacioCm?: number;

  @ApiPropertyOptional({ description: 'Unidades a lo largo del clisé (solo informativo)', example: 5 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  horizontal?: number;

  @ApiPropertyOptional({ description: 'Unidades a lo ancho del clisé (solo informativo)', example: 3 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  vertical?: number;
}

/** Datos del producto, organizados como las secciones de la plantilla de Excel. */
export class DatosProductoDto {
  @ApiProperty({ description: 'Minutos por plancha (dato de la operaria o sugerido)', example: 10 })
  @IsNumber()
  @IsPositive()
  moMin: number;

  @ApiProperty({ description: 'Unidades por plancha', example: 12 })
  @IsInt()
  @IsPositive()
  montaje: number;

  @ApiPropertyOptional({ description: 'Si no se envía, se usa el valor vigente' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorMinuto?: number;

  @ApiProperty({ example: 60 })
  @IsNumber()
  @Min(0)
  gramosPorClise: number;

  @ApiPropertyOptional({ description: 'Si no se envía, se usa el parámetro vigente PRECIO_GRAMO' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioGramo?: number;

  @ApiPropertyOptional({ description: 'Costo del troquel (fijo)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  troquel?: number;

  @ApiPropertyOptional({ type: [ItemDto], description: 'Troqueles por tipo (hierro, madera, eléctrico): se suman a troquel' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  troqueles?: ItemDto[];

  @ApiPropertyOptional({ type: CliseDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CliseDto)
  clise?: CliseDto;

  @ApiPropertyOptional({ description: 'Troquelada en $ por unidad. Tiene prioridad sobre troqueladasPorHora.', example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  troqueladaPorUnidad?: number;

  @ApiPropertyOptional({
    description: 'Unidades troqueladas por hora (operaria o sugerencia). Se convierte en $ por unidad = 60 × valor minuto / troqueladas por hora.',
    example: 225,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  troqueladasPorHora?: number;

  @ApiPropertyOptional({ type: [ItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  materialesAdicionales?: ItemDto[];

  @ApiPropertyOptional({ type: [ItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  armada?: ItemDto[];

  @ApiPropertyOptional({ type: [ItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  empaque?: ItemDto[];

  @ApiPropertyOptional({ type: [ItemDto], description: 'Diseño, perforada… (se suman a la mano de obra)' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  otros?: ItemDto[];

  @ApiPropertyOptional({ type: [ConceptoAdicionalDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ConceptoAdicionalDto)
  adicionales?: ConceptoAdicionalDto[];
}

export class PorcentajesDto {
  @ApiProperty({ example: [0.16, 0.1, 0.05], description: 'Un porcentaje por cantidad (se repite el último)' })
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  porcentajes: number[];

  @ApiPropertyOptional({ enum: ['PRIMERA_FILA', 'PROPIA_FILA'] })
  @IsOptional()
  @IsIn(['PRIMERA_FILA', 'PROPIA_FILA'])
  base?: 'PRIMERA_FILA' | 'PROPIA_FILA';
}

export class MargenDto {
  @ApiProperty({ example: 0.3 })
  @IsNumber()
  @Min(0)
  @Max(0.99)
  valor: number;

  @ApiPropertyOptional({ description: 'Índice de otro margen sobre cuyo precio se calcula este (vacío = sobre el costo)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sobre?: number;
}

/** Lo necesario para calcular una cotización (sin guardarla). */
export class CalcularCotizacionDto {
  @ApiProperty({ type: DatosProductoDto })
  @ValidateNested()
  @Type(() => DatosProductoDto)
  producto: DatosProductoDto;

  @ApiProperty({ example: [300, 500, 1000] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  cantidades: number[];

  @ApiPropertyOptional({ type: PorcentajesDto, description: 'Si no se envía, se usa la política de precios' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PorcentajesDto)
  cif?: PorcentajesDto;

  @ApiPropertyOptional({ type: PorcentajesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PorcentajesDto)
  administracion?: PorcentajesDto;

  @ApiPropertyOptional({ type: [MargenDto], description: 'Opciones de margen a comparar' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MargenDto)
  margenes?: MargenDto[];

  @ApiPropertyOptional({ example: 10, description: 'Redondear el precio al múltiplo indicado' })
  @IsOptional()
  @IsInt()
  @Min(0)
  redondeo?: number;

  @ApiPropertyOptional({ description: 'Horas de trabajo por día; si no se envía, se usa el parámetro vigente' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  horasPorDia?: number;

  @ApiPropertyOptional({ description: 'Política de precios a usar; si no se envía, la predeterminada' })
  @IsOptional()
  @IsInt()
  politicaId?: number;
}

export class GuardarCotizacionDto extends CalcularCotizacionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  clienteId?: number;

  @ApiPropertyOptional({ description: 'Crea el cliente si no existe (se ignora si viene clienteId)' })
  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @ApiProperty({ example: 'aplique', description: 'Código del tipo de producto' })
  @IsString()
  tipoProducto: string;

  @ApiPropertyOptional({ example: 'llavero logo' })
  @IsOptional()
  @IsString()
  referencia?: string;

  @ApiPropertyOptional({ example: 'Aplique en PVC, base más un color' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ enum: TipoCorte, example: 'BISTURI' })
  @IsOptional()
  @IsEnum(TipoCorte)
  tipoCorte?: TipoCorte;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  anchoCm?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  altoCm?: number;

  @ApiProperty({ example: 2, description: 'Número de tintas (incluida la base)' })
  @IsInt()
  @Min(0)
  tintas: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  espesor?: string;

  @ApiPropertyOptional({ enum: FuenteTiempo, description: 'De dónde salió el MO min' })
  @IsOptional()
  @IsEnum(FuenteTiempo)
  moMinFuente?: FuenteTiempo;

  @ApiPropertyOptional({ description: 'MO min que sugirió el sistema (para medir su precisión)' })
  @IsOptional()
  @IsNumber()
  moMinSugerido?: number;

  @ApiPropertyOptional({ description: 'Troqueladas por hora que sugirió el sistema (para medir su precisión)' })
  @IsOptional()
  @IsNumber()
  troqueladasPorHoraSugerida?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class EleccionMargenDto {
  @ApiProperty({ description: 'Orden de la fila de cantidad (desde 0)' })
  @IsInt()
  @Min(0)
  cantidadOrden: number;

  @ApiProperty({ description: 'Orden de la opción de margen elegida (desde 0); null quita la elección', nullable: true })
  @ValidateIf((_, valor) => valor !== null)
  @IsInt()
  @Min(0)
  margenOrden: number | null;
}

export class ElegirMargenesDto {
  @ApiProperty({ type: [EleccionMargenDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EleccionMargenDto)
  elecciones: EleccionMargenDto[];
}

export class CambiarEstadoDto {
  @ApiProperty({ enum: EstadoCotizacion })
  @IsEnum(EstadoCotizacion)
  estado: EstadoCotizacion;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}

export class TiempoRealDto {
  @ApiProperty({ description: 'Minutos reales por plancha medidos en producción', example: 11 })
  @IsNumber()
  @IsPositive()
  moMinReal: number;
}

export class FiltroCotizacionesDto {
  @ApiPropertyOptional({ enum: EstadoCotizacion })
  @IsOptional()
  @IsEnum(EstadoCotizacion)
  estado?: EstadoCotizacion;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clienteId?: number;

  @ApiPropertyOptional({ example: 'llavero' })
  @IsOptional()
  @IsString()
  tipoProducto?: string;

  @ApiPropertyOptional({ description: 'Busca en referencia, descripción y cliente' })
  @IsOptional()
  @IsString()
  buscar?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  porPagina?: number;
}

export class TextoClienteDto {
  @ApiProperty({
    nullable: true,
    example: 'Aplique en PVC\nBase más un color\nTamaño 5 x 2 cms\nCorte recto',
    description: 'Una línea por renglón del PDF. Vacío o null = las líneas por defecto (descripción y tamaño).',
  })
  @ValidateIf((_, valor) => valor !== null)
  @IsString()
  @MaxLength(2000)
  texto: string | null;
}
