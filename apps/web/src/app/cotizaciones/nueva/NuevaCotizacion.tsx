"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  costoClise,
  ESPACIO_SUGERIDO_CM,
  ErrorValidacion,
  gramosPorClise,
  manoDeObraPorUnidad,
  materialPorUnidad,
  tamanoClise,
  troqueladaPorUnidad,
  type TamanoClise,
} from "@kromatica/motor-calculo";
import {
  api,
  NOMBRE_CORTE,
  type ConceptoCatalogo,
  type Espesor,
  type GuardarCotizacion,
  type Parametros,
  type PoliticaPrecios,
  type SeccionConcepto,
  type TipoProducto,
  type CotizacionDetalle,
  type CotizacionGuardada,
  type BaseCalculo,
  type Item,
  type TipoCorte,
} from "@/lib/api";
import { calcularEnVivo } from "@/lib/calculo";
import { formatoNumero, formatoPesos, formatoPesosExacto, leerNumero } from "@/lib/formato";
import { Boton, Campo, claseEntrada, EntradaNumero, Seccion } from "@/componentes/campos";
import { SeccionConceptos, type FilaCalculada, type ItemLibre } from "@/componentes/SeccionConceptos";
import { TablaEspesores } from "@/componentes/TablaEspesores";
import { SugerenciaTiempo, SugerenciaTroquelada } from "@/componentes/Sugerencia";
import { TablaPrecios } from "@/componentes/TablaPrecios";
import { ValoresFijos } from "@/componentes/ValoresFijos";

interface Catalogos {
  parametros: Parametros;
  tipos: TipoProducto[];
  conceptos: ConceptoCatalogo[];
  espesores: Espesor[];
  politica: PoliticaPrecios;
}

/** Todo lo que escribe la persona, como texto: así un campo puede quedar vacío mientras se edita. */
interface Formulario {
  cliente: string;
  tipoProducto: string;
  referencia: string;
  descripcion: string;
  tipoCorte: TipoCorte | "";
  anchoCm: string;
  altoCm: string;
  tintas: string;
  espesor: string;
  /** Vacío = unidades del clisé (horizontal × vertical). */
  montaje: string;
  moMin: string;
  /** Vacío = calculado con el espesor y el área del clisé. */
  gramosPorClise: string;
  /** Vacío = el espacio que usa el Excel según el tipo de corte. */
  cliseEspacio: string;
  cliseHorizontal: string;
  cliseVertical: string;
  /** Vacío = calculada con las medidas y la disposición. */
  cliseCm2: string;
  cliseCantidad: string;
  troqueladasPorHora: string;
  /** Renglones del catálogo: código → valor escrito (vacío = no se usa). */
  conceptos: Record<string, string>;
  /** Renglones escritos a mano ("Otro") por sección. */
  libres: Record<SeccionConcepto, ItemLibre[]>;
  cantidades: string[];
  /** En porcentaje: "30" = 30 %. */
  margenes: string[];
  cif: string;
  cifBase: BaseCalculo;
  administracion: string;
  administracionBase: BaseCalculo;
  observaciones: string;
}

function formularioInicial(politica: PoliticaPrecios): Formulario {
  const porcentaje = (f: number) => formatoNumero(f * 100);
  return {
    cliente: "",
    tipoProducto: "",
    referencia: "",
    descripcion: "",
    tipoCorte: "",
    anchoCm: "",
    altoCm: "",
    tintas: "",
    espesor: "",
    montaje: "",
    moMin: "",
    gramosPorClise: "",
    cliseEspacio: "",
    cliseHorizontal: "",
    cliseVertical: "",
    cliseCm2: "",
    cliseCantidad: "1",
    troqueladasPorHora: "",
    conceptos: {},
    libres: { TROQUEL: [], CLISE: [], MATERIAL: [], ARMADA: [], EMPAQUE: [], OTROS: [], ADICIONAL: [] },
    cantidades: ["300", "500", "1000"],
    margenes: politica.margenesSugeridos.map(porcentaje),
    cif: politica.cifPorcentajes.map(porcentaje).join("; "),
    cifBase: politica.cifBase,
    administracion: porcentaje(politica.administracionPorcentaje),
    administracionBase: politica.administracionBase,
    observaciones: "",
  };
}

interface Renglon {
  codigo: string;
  nombre: string;
  tipoCosto: "POR_UNIDAD" | "FIJO";
  valor: number;
}

/** Renglones con valor de una sección: los del catálogo y los escritos a mano. */
function renglones(f: Formulario, catalogo: ConceptoCatalogo[], seccion: SeccionConcepto): Renglon[] {
  return [
    ...catalogo
      .filter((c) => c.seccion === seccion)
      .map((c) => ({ codigo: c.codigo, nombre: c.nombre, tipoCosto: c.tipoCosto, valor: leerNumero(f.conceptos[c.codigo] ?? "") })),
    ...f.libres[seccion].map((l, i) => ({
      codigo: `${seccion.toLowerCase()}_otro_${i + 1}`,
      nombre: l.nombre.trim() || "Otro",
      tipoCosto: l.tipoCosto,
      valor: leerNumero(l.valor),
    })),
  ].filter((r): r is Renglon => r.valor !== undefined && r.valor !== 0);
}

const aItems = (lista: Renglon[]) => lista.map(({ nombre, valor }) => ({ nombre, valor }));

const deTexto = (texto: string) => texto.trim() || undefined;

/** Valores que se calculan solos a partir de otros campos (clisé, gramos y montaje). */
interface Derivados {
  espacioCm: number;
  /** Tamaño del clisé, o null si faltan medidas o disposición. */
  tamano: TamanoClise | null;
  errorClise: string | null;
  cm2: number | undefined;
  /** Gramos por cm² del espesor elegido. */
  relacion: number | undefined;
  gramosCalculados: number | undefined;
  montaje: number | undefined;
}

function calcularDerivados(f: Formulario, espesores: Espesor[]): Derivados {
  const n = leerNumero;
  const espacioCm = n(f.cliseEspacio) ?? (f.tipoCorte ? ESPACIO_SUGERIDO_CM[f.tipoCorte] : 0);
  const [anchoCm, altoCm, horizontal, vertical] = [f.anchoCm, f.altoCm, f.cliseHorizontal, f.cliseVertical].map(n);
  let tamano: TamanoClise | null = null;
  let errorClise: string | null = null;
  if (anchoCm && altoCm && horizontal && vertical) {
    try {
      tamano = tamanoClise({ anchoCm, altoCm, espacioCm, horizontal, vertical });
    } catch (e) {
      if (!(e instanceof ErrorValidacion)) throw e;
      errorClise = e.message;
    }
  }
  const cm2 = n(f.cliseCm2) ?? tamano?.cm2;
  const relacion = espesores.find((e) => e.nombre === f.espesor)?.gramosPorCm2;
  // Como la columna "NUEVOS GRAMOS" del Excel: gramos enteros.
  const gramosCalculados = relacion && cm2 ? Math.round(gramosPorClise({ gramosPorCm2: relacion, cm2 })) : undefined;
  return { espacioCm, tamano, errorClise, cm2, relacion, gramosCalculados, montaje: n(f.montaje) ?? tamano?.unidades };
}

/** Convierte el formulario en la solicitud de la API y dice qué datos faltan para calcular o guardar. */
function construirSolicitud(f: Formulario, d: Derivados, catalogo: ConceptoCatalogo[]) {
  const n = leerNumero;
  const faltanCalculo: string[] = [];
  const moMin = n(f.moMin);
  const montaje = d.montaje;
  const gramosPorClise = n(f.gramosPorClise) ?? d.gramosCalculados;
  if (!moMin || moMin <= 0) faltanCalculo.push("MO min");
  if (!montaje || montaje <= 0) faltanCalculo.push("montaje (o la disposición del clisé)");
  if (gramosPorClise === undefined) faltanCalculo.push("gramos por clisé (elige el espesor o escríbelos)");

  const cantidades = f.cantidades.map(n).filter((q): q is number => q !== undefined && q > 0);
  if (cantidades.length === 0) faltanCalculo.push("al menos una cantidad");
  const margenes = f.margenes
    .map(n)
    .filter((m): m is number => m !== undefined)
    .map((m) => ({ valor: m / 100 }));
  if (margenes.length === 0) faltanCalculo.push("al menos un margen");
  const cif = f.cif
    .split(/[;\s]+/)
    .map(n)
    .filter((p): p is number => p !== undefined)
    .map((p) => p / 100);
  const administracion = n(f.administracion);

  const solicitud: GuardarCotizacion = {
    producto: {
      moMin: moMin ?? 0,
      montaje: montaje ?? 0,
      gramosPorClise: gramosPorClise ?? 0,
      troqueles: aItems(renglones(f, catalogo, "TROQUEL")),
      clise: d.cm2
        ? {
            cm2: d.cm2,
            cantidadClises: n(f.cliseCantidad) ?? 1,
            ...(d.tamano && { espacioCm: d.espacioCm, horizontal: n(f.cliseHorizontal), vertical: n(f.cliseVertical) }),
          }
        : undefined,
      troqueladasPorHora: n(f.troqueladasPorHora),
      materialesAdicionales: aItems(renglones(f, catalogo, "MATERIAL")),
      armada: aItems(renglones(f, catalogo, "ARMADA")),
      empaque: aItems(renglones(f, catalogo, "EMPAQUE")),
      otros: aItems(renglones(f, catalogo, "OTROS")),
      // Pantógrafo y adicionales (screen, samblasted…) van como conceptos propios, fijos o por unidad.
      adicionales: [...renglones(f, catalogo, "CLISE"), ...renglones(f, catalogo, "ADICIONAL")].map((r) => ({
        codigo: r.codigo,
        nombre: r.nombre,
        ...(r.tipoCosto === "FIJO" ? { fijo: r.valor } : { porUnidad: r.valor }),
      })),
    },
    cantidades,
    margenes,
    cif: cif.length > 0 ? { porcentajes: cif, base: f.cifBase } : undefined,
    administracion:
      administracion !== undefined ? { porcentajes: [administracion / 100], base: f.administracionBase } : undefined,
    clienteNombre: deTexto(f.cliente),
    tipoProducto: f.tipoProducto,
    referencia: deTexto(f.referencia),
    descripcion: deTexto(f.descripcion),
    tipoCorte: f.tipoCorte || undefined,
    anchoCm: n(f.anchoCm),
    altoCm: n(f.altoCm),
    tintas: n(f.tintas) ?? 0,
    espesor: deTexto(f.espesor),
    observaciones: deTexto(f.observaciones),
  };

  const faltanGuardar = [...faltanCalculo];
  if (!f.tipoProducto) faltanGuardar.unshift("tipo de producto");
  if (n(f.tintas) === undefined) faltanGuardar.push("tintas");
  return { solicitud, faltanCalculo, faltanGuardar };
}

/** Borrador que se está editando: el formulario reconstruido y lo que ya se había elegido. */
interface Edicion {
  id: number;
  consecutivo: number;
  formulario: Formulario;
  elecciones: Record<number, number>;
  moMinSugerido: number | null;
  troqueladaSugerida: number | null;
}

const aTexto = (valor: number | null | undefined) => (valor == null ? "" : String(valor));
/** Fracción → porcentaje como texto, sin el ruido de coma flotante (0,35 → "35"). */
const aPorcentaje = (fraccion: number) => String(Math.round(fraccion * 1e6) / 1e4);

/**
 * Reconstruye el formulario a partir de la entrada guardada (lo inverso de `construirSolicitud`). Los renglones
 * cuyo nombre o código está en el catálogo vuelven a su campo; los demás (escritos a mano, o de un concepto que
 * ya se retiró) quedan como "Otro". Los campos que eran calculados (área, montaje, gramos, espacio) quedan vacíos
 * si el valor guardado coincide con el calculado, para que sigan recalculándose.
 */
function formularioDesdeCotizacion(c: CotizacionDetalle, catalogos: Catalogos): Formulario {
  const base = formularioInicial(catalogos.politica);
  const e = c.entrada;
  if (!e) return base;
  const p = e.producto;
  const conceptos: Record<string, string> = {};
  const libres = Object.fromEntries(Object.keys(base.libres).map((k) => [k, [] as ItemLibre[]])) as Formulario["libres"];

  const agregar = (seccion: SeccionConcepto, item: { codigo?: string; nombre: string; valor: number }, tipoCosto: ItemLibre["tipoCosto"]) => {
    const enCatalogo = catalogos.conceptos.find(
      (k) =>
        k.seccion === seccion && (item.codigo ? k.codigo === item.codigo : k.nombre === item.nombre) && !(k.codigo in conceptos),
    );
    if (enCatalogo) conceptos[enCatalogo.codigo] = String(item.valor);
    else libres[seccion].push({ nombre: item.nombre, valor: String(item.valor), tipoCosto });
  };
  const listas: [SeccionConcepto, Item[] | undefined][] = [
    ["TROQUEL", p.troqueles],
    ["MATERIAL", p.materialesAdicionales],
    ["ARMADA", p.armada],
    ["EMPAQUE", p.empaque],
    ["OTROS", p.otros],
  ];
  for (const [seccion, items] of listas) {
    for (const item of items ?? []) agregar(seccion, item, seccion === "TROQUEL" ? "FIJO" : "POR_UNIDAD");
  }
  if (p.troquel) agregar("TROQUEL", { nombre: "Troquel", valor: p.troquel }, "FIJO");
  for (const a of p.adicionales ?? []) {
    const seccion: SeccionConcepto =
      catalogos.conceptos.find((k) => k.codigo === a.codigo)?.seccion === "CLISE" || a.codigo.startsWith("clise_")
        ? "CLISE"
        : "ADICIONAL";
    agregar(seccion, { codigo: a.codigo, nombre: a.nombre, valor: a.fijo ?? a.porUnidad ?? 0 }, a.fijo != null ? "FIJO" : "POR_UNIDAD");
  }

  const tipoCorte = e.tipoCorte ?? c.tipoCorte ?? "";
  const clise = p.clise;
  const espacioSugerido = tipoCorte ? ESPACIO_SUGERIDO_CM[tipoCorte] : 0;
  const f: Formulario = {
    ...base,
    cliente: e.clienteNombre ?? c.cliente?.nombre ?? "",
    tipoProducto: e.tipoProducto ?? c.tipoProducto?.codigo ?? "",
    referencia: e.referencia ?? "",
    descripcion: e.descripcion ?? "",
    tipoCorte,
    anchoCm: aTexto(e.anchoCm),
    altoCm: aTexto(e.altoCm),
    tintas: aTexto(e.tintas),
    espesor: e.espesor ?? "",
    moMin: aTexto(p.moMin),
    cliseEspacio: clise?.espacioCm == null || clise.espacioCm === espacioSugerido ? "" : String(clise.espacioCm),
    cliseHorizontal: aTexto(clise?.horizontal),
    cliseVertical: aTexto(clise?.vertical),
    cliseCantidad: aTexto(clise?.cantidadClises ?? 1),
    troqueladasPorHora: aTexto(p.troqueladasPorHora ?? c.troqueladasPorHora),
    conceptos,
    libres,
    cantidades: e.cantidades.map(String),
    margenes: (e.margenes ?? c.margenes).map((m) => aPorcentaje(m.valor)),
    cif: e.cif ? e.cif.porcentajes.map(aPorcentaje).join("; ") : base.cif,
    cifBase: e.cif?.base ?? base.cifBase,
    administracion: e.administracion?.porcentajes[0] != null ? aPorcentaje(e.administracion.porcentajes[0]) : base.administracion,
    administracionBase: e.administracion?.base ?? base.administracionBase,
    observaciones: e.observaciones ?? "",
  };

  // Área: vacía si es la que da la calculadora. Montaje y gramos: vacíos si son los calculados.
  const sinArea = calcularDerivados({ ...f, cliseCm2: "", montaje: "", gramosPorClise: "" }, catalogos.espesores);
  const cliseCm2 = clise && (!sinArea.tamano || Math.abs(sinArea.tamano.cm2 - clise.cm2) > 1e-6) ? String(clise.cm2) : "";
  const d = calcularDerivados({ ...f, cliseCm2, montaje: "", gramosPorClise: "" }, catalogos.espesores);
  return {
    ...f,
    cliseCm2,
    montaje: d.montaje === p.montaje ? "" : String(p.montaje),
    gramosPorClise: d.gramosCalculados === p.gramosPorClise ? "" : String(p.gramosPorClise),
  };
}

/** Pantalla "Nueva cotización"; con `id`, edita ese borrador. */
export function NuevaCotizacion({ id }: { id?: number }) {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.parametros(),
      api.tiposProducto(),
      api.conceptos(),
      api.espesores(),
      api.politicas(),
      id ? api.obtenerCotizacion(id) : null,
    ])
      .then(([parametros, tipos, conceptos, espesores, politicas, cotizacion]) => {
        const politica = politicas.find((p) => p.predeterminada) ?? politicas[0];
        if (!politica) throw new Error("No hay una política de precios configurada");
        const cargados = { parametros, tipos, conceptos, espesores, politica };
        if (cotizacion) {
          if (cotizacion.estado !== "BORRADOR") {
            throw new Error(`La cotización n.º ${cotizacion.consecutivo} ya no es un borrador: no se puede editar`);
          }
          setEdicion({
            id: cotizacion.id,
            consecutivo: cotizacion.consecutivo,
            formulario: formularioDesdeCotizacion(cotizacion, cargados),
            elecciones: Object.fromEntries(
              cotizacion.cantidades.filter((q) => q.margenElegidoOrden != null).map((q) => [q.orden, q.margenElegidoOrden!]),
            ),
            moMinSugerido: cotizacion.moMinSugerido,
            troqueladaSugerida: cotizacion.troqueladasPorHoraSugerida,
          });
        }
        setCatalogos(cargados);
      })
      .catch((e: unknown) =>
        setErrorCarga(e instanceof Error ? e.message : "No se pudo conectar con la API"),
      );
  }, [id]);

  if (errorCarga) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-medium">{id ? "No se pudo abrir la cotización." : "No se pudieron cargar los catálogos."}</p>
        <p className="mt-1">{errorCarga}</p>
        {id ? (
          <Link href={`/cotizaciones/${id}`} className="mt-2 inline-block text-violet-700 hover:underline">
            ← Volver a la cotización
          </Link>
        ) : (
          <p className="mt-2 text-rose-700">
            ¿Está corriendo la API? <code className="rounded bg-rose-100 px-1">pnpm dev:api</code> (puerto 4000).
          </p>
        )}
      </div>
    );
  }
  if (!catalogos) return <p className="text-sm text-slate-500">Cargando…</p>;
  return <FormularioCotizacion catalogos={catalogos} edicion={edicion} />;
}

function FormularioCotizacion({ catalogos, edicion }: { catalogos: Catalogos; edicion: Edicion | null }) {
  const { parametros, politica, tipos, conceptos, espesores } = catalogos;
  const router = useRouter();
  const [f, setF] = useState<Formulario>(() => edicion?.formulario ?? formularioInicial(politica));
  const [elecciones, setElecciones] = useState<Record<number, number>>(edicion?.elecciones ?? {});
  const [moMinSugerido, setMoMinSugerido] = useState<number | null>(edicion?.moMinSugerido ?? null);
  const [troqueladaSugerida, setTroqueladaSugerida] = useState<number | null>(edicion?.troqueladaSugerida ?? null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [guardada, setGuardada] = useState<CotizacionGuardada | null>(null);

  const cambiar = <K extends keyof Formulario>(campo: K) => (valor: Formulario[K]) =>
    setF((actual) => ({ ...actual, [campo]: valor }));

  const derivados = useMemo(() => calcularDerivados(f, espesores), [f, espesores]);
  const { solicitud, faltanCalculo, faltanGuardar } = useMemo(
    () => construirSolicitud(f, derivados, conceptos),
    [f, derivados, conceptos],
  );
  const calculo = useMemo(
    () => (faltanCalculo.length === 0 ? calcularEnVivo(solicitud, parametros, politica) : null),
    [solicitud, faltanCalculo, parametros, politica],
  );

  // Las elecciones que apuntan a filas o márgenes que ya no existen se descartan.
  const filas = calculo?.ok ? calculo.valor.resultado.filas.length : 0;
  const columnas = solicitud.margenes?.length ?? 0;
  const eleccionesValidas = Object.fromEntries(
    Object.entries(elecciones).filter(([fila, margen]) => Number(fila) < filas && margen < columnas),
  ) as Record<number, number>;

  const consultaTiempo =
    leerNumero(f.tintas) !== undefined && (derivados.montaje ?? 0) > 0
      ? {
          tipoProducto: f.tipoProducto || undefined,
          tintas: leerNumero(f.tintas)!,
          montaje: derivados.montaje!,
          anchoCm: leerNumero(f.anchoCm),
          altoCm: leerNumero(f.altoCm),
        }
      : null;
  const consultaTroquelada =
    f.tipoProducto || (leerNumero(f.anchoCm) && leerNumero(f.altoCm))
      ? {
          tipoProducto: f.tipoProducto || undefined,
          tipoCorte: f.tipoCorte || undefined,
          anchoCm: leerNumero(f.anchoCm),
          altoCm: leerNumero(f.altoCm),
          montaje: derivados.montaje,
          espesor: f.espesor || undefined,
          tintas: leerNumero(f.tintas),
        }
      : null;
  const troqueladasPorHora = leerNumero(f.troqueladasPorHora);
  const valorMinuto = parametros.VALOR_MINUTO.valor;
  const precioGramo = parametros.PRECIO_GRAMO.valor;
  const precioCm2 = parametros.PRECIO_CM2_CLISE.valor;
  const montaje = derivados.montaje;
  const moMin = leerNumero(f.moMin);
  const gramos = solicitud.producto.gramosPorClise;
  const cantidadClises = leerNumero(f.cliseCantidad) ?? 1;

  // Renglones que se calculan solos, como en el Excel (material rubber, M.O. rubber, clisé).
  const filaClise: FilaCalculada = {
    nombre: "Clisé",
    valor: derivados.cm2 ? costoClise({ cm2: derivados.cm2, cantidadClises, precioCm2 }) : null,
    detalle: derivados.cm2
      ? `${formatoNumero(derivados.cm2)} cm² × ${cantidadClises} × ${formatoPesos(precioCm2)}`
      : "Falta el área del clisé (Dimensiones del producto)",
    fijo: true,
  };
  const filaMaterial: FilaCalculada = {
    nombre: "Material rubber",
    valor: montaje && gramos ? materialPorUnidad({ gramosPorClise: gramos, precioGramo, montaje }) : null,
    detalle: montaje && gramos ? `${formatoNumero(gramos)} g × ${formatoPesos(precioGramo)} ÷ ${montaje}` : "Faltan gramos y montaje",
  };
  const filaManoDeObra: FilaCalculada = {
    nombre: "M.O. rubber",
    valor: montaje && moMin ? manoDeObraPorUnidad({ valorMinuto, moMin, montaje }) : null,
    detalle: montaje && moMin ? `${formatoPesos(valorMinuto)} × ${formatoNumero(moMin)} min ÷ ${montaje}` : "Faltan MO min y montaje",
  };
  const seccionCostos = (
    seccion: SeccionConcepto,
    extra?: { tipoLibres?: "POR_UNIDAD" | "FIJO" | "ELEGIR"; calculadas?: FilaCalculada[] },
  ) => (
    <SeccionConceptos
      catalogo={conceptos.filter((c) => c.seccion === seccion)}
      valores={f.conceptos}
      alCambiarValor={(codigo, valor) => setF((a) => ({ ...a, conceptos: { ...a.conceptos, [codigo]: valor } }))}
      libres={f.libres[seccion]}
      alCambiarLibres={(items) => setF((a) => ({ ...a, libres: { ...a.libres, [seccion]: items } }))}
      {...extra}
    />
  );

  const guardar = async () => {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const cuerpo: GuardarCotizacion = {
        ...solicitud,
        moMinSugerido: moMinSugerido ?? undefined,
        moMinFuente:
          moMinSugerido === null
            ? "OPERARIA"
            : moMin === moMinSugerido
              ? "SUGERENCIA_ACEPTADA"
              : "SUGERENCIA_CORREGIDA",
        troqueladasPorHoraSugerida: troqueladaSugerida ?? undefined,
      };
      // Al editar, la API recalcula y quita los precios elegidos: se vuelven a enviar.
      const guardadaApi = edicion ? await api.actualizarCotizacion(edicion.id, cuerpo) : await api.crearCotizacion(cuerpo);
      const lista = Object.entries(eleccionesValidas).map(([fila, margen]) => ({
        cantidadOrden: Number(fila),
        margenOrden: margen,
      }));
      if (lista.length > 0) await api.elegirMargenes(guardadaApi.id, lista);
      if (edicion) {
        router.push(`/cotizaciones/${edicion.id}`);
        return;
      }
      setGuardada(guardadaApi);
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const nueva = () => {
    setF(formularioInicial(politica));
    setElecciones({});
    setMoMinSugerido(null);
    setTroqueladaSugerida(null);
    setGuardada(null);
  };

  if (guardada) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-800">Cotización n.º {guardada.consecutivo} guardada</p>
        <p className="mt-1 text-sm text-emerald-700">Quedó en estado borrador.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Boton variante="primario" onClick={nueva}>
            Hacer otra cotización
          </Boton>
          <Link
            href={`/cotizaciones/${guardada.id}`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver cotización
          </Link>
        </div>
      </div>
    );
  }

  const numero = (campo: keyof Formulario, props?: { placeholder?: string; prefijo?: string; sufijo?: string }) => (
    <EntradaNumero valor={f[campo] as string} alCambiar={cambiar(campo) as (v: string) => void} {...props} />
  );
  const texto = (campo: keyof Formulario, placeholder?: string) => (
    <input
      className={claseEntrada}
      value={f[campo] as string}
      placeholder={placeholder}
      onChange={(e) => cambiar(campo)(e.target.value as never)}
    />
  );
  const cantidadElegidas = Object.keys(eleccionesValidas).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-4">
        <div>
          {edicion && (
            <Link href={`/cotizaciones/${edicion.id}`} className="text-sm text-violet-700 hover:underline">
              ← Volver sin guardar
            </Link>
          )}
          <h1 className="text-xl font-semibold tracking-tight">
            {edicion ? `Editar cotización n.º ${edicion.consecutivo}` : "Nueva cotización"}
          </h1>
          <p className="text-sm text-slate-500">
            Los precios se recalculan mientras escribes
            {edicion ? ", con los valores fijos vigentes hoy." : "."}
          </p>
        </div>

        <Seccion titulo="Producto">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Cliente" className="col-span-2">
              {texto("cliente", "Ej. Nombre del cliente")}
            </Campo>
            <Campo etiqueta="Tipo de producto" obligatorio>
              <select
                className={claseEntrada}
                value={f.tipoProducto}
                onChange={(e) => cambiar("tipoProducto")(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {tipos.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Referencia">{texto("referencia")}</Campo>
            <Campo etiqueta="Descripción" className="col-span-2">
              {texto("descripcion", "Ej. Aplique en PVC, base más un color")}
            </Campo>
            <Campo etiqueta="Tintas" obligatorio ayuda="Incluida la base">
              {numero("tintas")}
            </Campo>
            <Campo etiqueta="Tipo de corte" className="col-span-2">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de corte">
                {(Object.keys(NOMBRE_CORTE) as TipoCorte[]).map((corte) => (
                  <button
                    key={corte}
                    type="button"
                    role="radio"
                    aria-checked={f.tipoCorte === corte}
                    onClick={() => cambiar("tipoCorte")(f.tipoCorte === corte ? "" : corte)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      f.tipoCorte === corte
                        ? "border-violet-500 bg-violet-50 text-violet-800"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {NOMBRE_CORTE[corte]}
                  </button>
                ))}
              </div>
            </Campo>
          </div>
        </Seccion>

        <Seccion
          titulo="Dimensiones del producto"
          ayuda="Medidas, cómo se acomodan en el clisé y espesor: de aquí salen el área del clisé, el montaje y los gramos."
        >
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Ancho">{numero("anchoCm", { sufijo: "cm" })}</Campo>
            <Campo etiqueta="Alto">{numero("altoCm", { sufijo: "cm" })}</Campo>
          </div>
          <div className="mt-3 grid grid-cols-3 items-end gap-3">
            <Campo etiqueta="Espacio entre">
              {numero("cliseEspacio", { sufijo: "cm", placeholder: formatoNumero(derivados.espacioCm) })}
            </Campo>
            <Campo etiqueta="Unidades a lo largo">{numero("cliseHorizontal")}</Campo>
            <Campo etiqueta="Unidades a lo ancho">{numero("cliseVertical")}</Campo>
          </div>
          <ResumenClise
            derivados={derivados}
            hayMedidas={Boolean(leerNumero(f.anchoCm) && leerNumero(f.altoCm))}
            cantidad={cantidadClises}
            precioCm2={precioCm2}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Campo etiqueta="Área del clisé" ayuda={derivados.tamano ? "Vacío = la calculada" : "Si no usas la calculadora"}>
              {numero("cliseCm2", {
                sufijo: "cm²",
                placeholder: derivados.tamano ? formatoNumero(derivados.tamano.cm2) : undefined,
              })}
            </Campo>
            <Campo etiqueta="N.º de clisés">{numero("cliseCantidad")}</Campo>
          </div>
          <p className="mb-1 mt-4 text-xs font-medium text-slate-700">Espesor · gramos por cm²</p>
          <TablaEspesores espesores={espesores} elegido={f.espesor} alElegir={cambiar("espesor")} cm2={derivados.cm2} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Gramos por clisé"
              obligatorio
              ayuda={
                derivados.gramosCalculados !== undefined
                  ? `${f.espesor}: ${formatoNumero(derivados.relacion!)} g/cm² × ${formatoNumero(derivados.cm2!)} cm²`
                  : "Elige el espesor en la tabla o escríbelos"
              }
            >
              {numero("gramosPorClise", {
                sufijo: "g",
                placeholder: derivados.gramosCalculados !== undefined ? String(derivados.gramosCalculados) : undefined,
              })}
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Producción" ayuda="La operaria aporta el MO min y las troqueladas por hora; el sistema puede sugerirlos.">
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Montaje"
              obligatorio
              ayuda={derivados.tamano && !leerNumero(f.montaje) ? "Unidades del clisé" : "Unidades por plancha"}
            >
              {numero("montaje", { placeholder: derivados.tamano ? String(derivados.tamano.unidades) : undefined })}
            </Campo>
            <Campo
              etiqueta="MO min"
              obligatorio
              ayuda={
                leerNumero(f.moMin)
                  ? `${formatoNumero(60 / leerNumero(f.moMin)!)} planchas por hora`
                  : "Minutos por plancha"
              }
            >
              {numero("moMin", { sufijo: "min" })}
            </Campo>
            <div className="col-span-2">
              <SugerenciaTiempo
                consulta={consultaTiempo}
                alObtener={setMoMinSugerido}
                alUsar={(moMin) => cambiar("moMin")(String(moMin))}
              />
            </div>
            <Campo
              etiqueta="Troqueladas por hora"
              className="col-span-2"
              ayuda={
                troqueladasPorHora
                  ? `= ${formatoPesosExacto(troqueladaPorUnidad({ valorMinuto, troqueladasPorHora }))} por unidad (60 × ${formatoPesos(valorMinuto)} ÷ ${formatoNumero(troqueladasPorHora)})`
                  : "Unidades que se troquelan en una hora. Se convierte en $ por unidad."
              }
            >
              <div className="w-40">{numero("troqueladasPorHora", { sufijo: "/ hora" })}</div>
            </Campo>
            <div className="col-span-2">
              <SugerenciaTroquelada
                consulta={consultaTroquelada}
                alObtener={setTroqueladaSugerida}
                alUsar={(porHora) => cambiar("troqueladasPorHora")(String(porHora))}
              />
            </div>
          </div>
        </Seccion>

        <Seccion titulo="1. Troqueles" ayuda="Costos fijos: se reparten entre todas las unidades.">
          {seccionCostos("TROQUEL", { tipoLibres: "FIJO" })}
        </Seccion>

        <Seccion titulo="2. Clisé" ayuda="Costos fijos: se reparten entre todas las unidades.">
          {seccionCostos("CLISE", { tipoLibres: "FIJO", calculadas: [filaClise] })}
        </Seccion>

        <Seccion titulo="6. Material" ayuda="Valores por unidad.">
          {seccionCostos("MATERIAL", { calculadas: [filaMaterial] })}
        </Seccion>

        <Seccion titulo="7. Armada" ayuda="Valores por unidad.">
          {seccionCostos("ARMADA")}
        </Seccion>

        <Seccion titulo="8. Empaque" ayuda="Valores por unidad.">
          {seccionCostos("EMPAQUE")}
        </Seccion>

        <Seccion titulo="9. Otros materiales" ayuda="Valores por unidad. Se suman a la mano de obra.">
          {seccionCostos("OTROS", { calculadas: [filaManoDeObra] })}
        </Seccion>

        <Seccion titulo="Adicionales" ayuda="Screen, alta frecuencia, samblasted, mate, flete… Fijos o por unidad.">
          {seccionCostos("ADICIONAL", { tipoLibres: "ELEGIR" })}
        </Seccion>

        <Seccion titulo="Observaciones">
          <textarea
            className={`${claseEntrada} min-h-20`}
            value={f.observaciones}
            onChange={(e) => cambiar("observaciones")(e.target.value)}
          />
        </Seccion>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Seccion titulo="Cantidades">
          <div className="flex flex-wrap items-center gap-2">
            {f.cantidades.map((q, i) => (
              <div key={i} className="flex w-32 items-center">
                <input
                  inputMode="numeric"
                  aria-label={`Cantidad ${i + 1}`}
                  className={`${claseEntrada} rounded-r-none tabular-nums`}
                  value={q}
                  onChange={(e) => cambiar("cantidades")(f.cantidades.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button
                  type="button"
                  aria-label={`Quitar cantidad ${q}`}
                  className="rounded-r-md border border-l-0 border-slate-300 px-2 py-1.5 text-sm text-slate-400 hover:text-rose-600"
                  onClick={() => cambiar("cantidades")(f.cantidades.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <Boton variante="fantasma" onClick={() => cambiar("cantidades")([...f.cantidades, ""])}>
              + cantidad
            </Boton>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            De menor a mayor. El CIF y la administración se calculan sobre la primera (la más pequeña).
          </p>
        </Seccion>

        <Seccion titulo="Precios por unidad">
          {faltanCalculo.length > 0 && (
            <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Falta: {faltanCalculo.join(", ")}.
            </p>
          )}
          {calculo && !calculo.ok && (
            <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{calculo.error}</p>
          )}
          <TablaPrecios
            calculo={calculo?.ok ? calculo.valor : null}
            margenes={f.margenes}
            alCambiarMargenes={cambiar("margenes")}
            elecciones={eleccionesValidas}
            alElegir={(fila, margen) =>
              setElecciones((e) => {
                const resto = Object.fromEntries(Object.entries(e).filter(([k]) => Number(k) !== fila));
                return margen === null ? resto : { ...resto, [fila]: margen };
              })
            }
          />
        </Seccion>

        <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold">CIF y administración</summary>
          <p className="mt-1 text-xs text-slate-500">Política «{politica.nombre}». Cámbialo solo para esta cotización.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Campo etiqueta="CIF por cantidad (%)" ayuda="Separados por «;». Se repite el último.">
              <input className={claseEntrada} value={f.cif} onChange={(e) => cambiar("cif")(e.target.value)} />
            </Campo>
            <Campo etiqueta="CIF sobre">
              <SelectorBase valor={f.cifBase} alCambiar={cambiar("cifBase")} />
            </Campo>
            <Campo etiqueta="Administración">{numero("administracion", { sufijo: "%" })}</Campo>
            <Campo etiqueta="Administración sobre">
              <SelectorBase valor={f.administracionBase} alCambiar={cambiar("administracionBase")} />
            </Campo>
          </div>
        </details>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {errorGuardar && <p className="mb-3 text-sm text-rose-700">{errorGuardar}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {faltanGuardar.length > 0
                ? `Para guardar falta: ${faltanGuardar.join(", ")}.`
                : cantidadElegidas < filas
                  ? `Precio elegido en ${cantidadElegidas} de ${filas} cantidades. Puedes elegir después.`
                  : edicion
                    ? "Listo para guardar los cambios."
                    : "Listo para guardar como borrador."}
            </p>
            <Boton
              variante="primario"
              onClick={guardar}
              disabled={faltanGuardar.length > 0 || !calculo?.ok || guardando}
            >
              {guardando ? "Guardando…" : edicion ? "Guardar cambios" : "Guardar borrador"}
            </Boton>
          </div>
        </div>

        <ValoresFijos parametros={parametros} />
      </div>
    </div>
  );
}

function SelectorBase({ valor, alCambiar }: { valor: BaseCalculo; alCambiar: (v: BaseCalculo) => void }) {
  return (
    <select className={claseEntrada} value={valor} onChange={(e) => alCambiar(e.target.value as BaseCalculo)}>
      <option value="PRIMERA_FILA">La primera cantidad</option>
      <option value="PROPIA_FILA">Cada cantidad</option>
    </select>
  );
}

/** Resultado de la calculadora del clisé: tamaño, área, unidades y costo, o qué falta para calcularlo. */
function ResumenClise({
  derivados,
  hayMedidas,
  cantidad,
  precioCm2,
}: {
  derivados: Derivados;
  hayMedidas: boolean;
  cantidad: number;
  precioCm2: number;
}) {
  const { tamano, errorClise } = derivados;
  if (errorClise) return <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorClise}</p>;
  if (!tamano) {
    return (
      <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {hayMedidas
          ? "Indica cuántas unidades van a lo largo y a lo ancho para calcular el clisé."
          : "Indica el ancho y el alto del producto para calcular el clisé."}
      </p>
    );
  }
  return (
    <div
      className={`mt-3 rounded-md px-3 py-2 text-sm ${tamano.cabe ? "bg-violet-50/60 text-slate-700" : "bg-rose-50 text-rose-800"}`}
    >
      <p className="tabular-nums">
        Clisé de{" "}
        <strong>
          {formatoNumero(tamano.largoCm)} × {formatoNumero(tamano.anchoCm)} cm
        </strong>{" "}
        = {formatoNumero(tamano.cm2)} cm² · {tamano.unidades} unidades · {cantidad === 1 ? "costo" : `${cantidad} clisés`}{" "}
        {formatoPesos(costoClise({ cm2: tamano.cm2, cantidadClises: cantidad, precioCm2 }))}
      </p>
      {!tamano.cabe && <p className="mt-1 text-xs font-medium">No cabe en el área disponible de 25 × 30 cm.</p>}
    </div>
  );
}
