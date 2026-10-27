"""
Genera casos de prueba ("golden tests") a partir de las hojas del Excel histórico.

Para cada hoja con la plantilla estándar (encabezado "cantidad" en A46) extrae:
  - las cantidades cotizadas,
  - cada concepto de costo descompuesto en  costo_unitario = porUnidad + fijo / cantidad,
  - la configuración de CIF y administración leída de las fórmulas,
  - los márgenes y sobre qué columna se calcula cada precio,
  - los valores que el Excel calculó (costo total y precios) para comparar.

También extrae casos para las fórmulas de insumos (material, mano de obra,
planchas por hora y días requeridos).

Uso:
    python 01_volcar_celdas.py Cotizaciones.xlsx celdas.json
    python 02_generar_casos_prueba.py celdas.json ../../datos-privados
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

COLUMNAS_CONCEPTO = "BCDEFGHIJ"  # B..J: conceptos que suman el subtotal (Excel: SUM(B:J))
FILA_ENCABEZADO = 46


def normalizar(texto):
    texto = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", texto).strip()


def col_a_num(col):
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def num_a_col(n):
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def numero(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


CODIGOS = {
    "troquel": "troquel", "clise": "clise", "troquelada": "troquelada", "screen": "screen",
    "samblasted": "samblasted", "samblsted": "samblasted", "samblaste": "samblasted",
    "samblsated": "samblasted", "alta fre": "alta_frecuencia", "armada": "armada",
    "material": "material", "otros": "otros", "empaq": "empaque", "tpu": "tpu", "flete": "flete",
    "mate": "mate", "matizado": "matizado",
}


def extraer_cotizacion(nombre, hoja):
    v, f = hoja["v"], hoja["f"]
    if normalizar(v.get(f"A{FILA_ENCABEZADO}", "")) != "cantidad":
        return None, "plantilla distinta"

    # Filas de cantidades con costo total calculado por fórmula
    filas = []
    for r in range(FILA_ENCABEZADO + 1, FILA_ENCABEZADO + 9):
        q = numero(v.get(f"A{r}"))
        ct = numero(v.get(f"M{r}"))
        if q and q > 0 and ct and str(f.get(f"M{r}", "")).startswith("=SUM(B"):
            filas.append(r)
        elif filas:
            break
    if not filas:
        return None, "sin filas de cantidad"
    cantidades = [numero(v[f"A{r}"]) for r in filas]

    # Conceptos: costo = porUnidad + fijo / cantidad
    conceptos = []
    for col in COLUMNAS_CONCEPTO:
        valores = [numero(v.get(f"{col}{r}")) or 0.0 for r in filas]
        if all(abs(x) < 1e-9 for x in valores):
            continue
        encabezado = normalizar(v.get(f"{col}{FILA_ENCABEZADO}", "")) or col
        if len(filas) >= 2:
            q1, q2 = cantidades[0], cantidades[1]
            y1, y2 = valores[0], valores[1]
            if q1 == q2:
                return None, "cantidades repetidas"
            fijo = (y1 - y2) / (1 / q1 - 1 / q2)
            por_unidad = y1 - fijo / q1
        else:
            formula = str(f.get(f"{col}{filas[0]}", ""))
            if re.search(r"/\$?A\$?\d+", formula):
                fijo, por_unidad = valores[0] * cantidades[0], 0.0
            else:
                fijo, por_unidad = 0.0, valores[0]
        for q, y in zip(cantidades, valores):
            if abs(por_unidad + fijo / q - y) > 1e-6 * max(1, abs(y)):
                return None, f"concepto {encabezado} no es lineal en 1/cantidad"
        if abs(fijo) < 1e-7:
            fijo = 0.0
        if abs(por_unidad) < 1e-7:
            por_unidad = 0.0
        conceptos.append({
            "codigo": CODIGOS.get(encabezado, re.sub(r"[^a-z0-9]+", "_", encabezado)),
            "nombre": encabezado,
            "porUnidad": por_unidad,
            "fijo": fijo,
        })

    # Porcentaje + fila base de una celda "SUM(Bx:Jx)*p"
    def leer_porcentaje(celda):
        formula = str(f.get(celda, ""))
        m = re.fullmatch(r"=\+?SUM\(B(\d+):J(\d+)\)\*([\d.]+)", formula.replace(" ", ""))
        if not m or m.group(1) != m.group(2):
            return None
        fila_base = int(m.group(1))
        if fila_base not in filas:
            return None
        return float(m.group(3)), filas.index(fila_base)

    def leer_referencia(celda):
        formula = str(f.get(celda, "")).replace(" ", "")
        m = re.fullmatch(r"=\+?\$?([A-Z]+)\$?(\d+)", formula)
        return f"{m.group(1)}{m.group(2)}" if m else None

    # CIF: L{r} -> N{k} -> SUM(B:J)*p
    cif = []
    for r in filas:
        ref = leer_referencia(f"L{r}")
        if ref is None:
            valor = numero(v.get(f"L{r}")) or 0.0
            if abs(valor) > 1e-9:
                return None, "CIF escrito a mano"
            cif.append({"porcentaje": 0.0, "filaBase": filas.index(r)})
            continue
        leido = leer_porcentaje(ref)
        if leido is None:
            return None, "CIF con fórmula no estándar"
        cif.append({"porcentaje": leido[0], "filaBase": leido[1]})

    # Administración: K{r} -> N{k} -> SUM(B:J)*p  (normalmente la misma celda para todas las filas)
    admon = []
    for r in filas:
        ref = leer_referencia(f"K{r}")
        if ref is None:
            valor = numero(v.get(f"K{r}")) or 0.0
            if abs(valor) > 1e-9:
                return None, "administración escrita a mano"
            admon.append({"porcentaje": 0.0, "filaBase": filas.index(r)})
            continue
        leido = leer_porcentaje(ref)
        if leido is None:
            return None, "administración con fórmula no estándar"
        admon.append({"porcentaje": leido[0], "filaBase": leido[1]})

    # Márgenes: encabezados numéricos (0, 1) en N46.. ; precio = X/(1-margen)
    margenes = []
    columnas_margen = {}
    for c in range(col_a_num("N"), col_a_num("N") + 8):
        col = num_a_col(c)
        m = numero(v.get(f"{col}{FILA_ENCABEZADO}"))
        if m is None or not (0 < m < 1):
            continue
        formula = str(f.get(f"{col}{filas[0]}", "")).replace(" ", "")
        mm = re.fullmatch(rf"=\+?([A-Z]+){filas[0]}/\(1-\$?{col}\$?{FILA_ENCABEZADO}\)", formula)
        if not mm:
            continue
        columnas_margen[col] = len(margenes)
        margenes.append({"valor": m, "_col": col, "_ref": mm.group(1)})
    if not margenes:
        return None, "sin márgenes"
    for mg in margenes:
        ref = mg.pop("_ref")
        mg.pop("_col")
        if ref == "M":
            mg["sobre"] = "COSTO"
        elif ref in columnas_margen:
            mg["sobre"] = columnas_margen[ref]
        else:
            return None, "margen sobre columna desconocida"

    esperado = []
    for r in filas:
        precios = []
        for col in columnas_margen:
            precios.append(numero(v.get(f"{col}{r}")))
        esperado.append({
            "subtotal": sum(numero(v.get(f"{c}{r}")) or 0.0 for c in COLUMNAS_CONCEPTO),
            "administracion": numero(v.get(f"K{r}")) or 0.0,
            "cif": numero(v.get(f"L{r}")) or 0.0,
            "costoTotal": numero(v[f"M{r}"]),
            "precios": precios,
        })
    if any(p is None for e in esperado for p in e["precios"]):
        return None, "precio vacío"

    return {
        "hoja": nombre,
        "entrada": {
            "cantidades": cantidades,
            "conceptos": conceptos,
            "cif": cif,
            "administracion": admon,
            "margenes": margenes,
        },
        "esperado": esperado,
    }, None


def extraer_insumos(nombre, hoja):
    """Casos para fórmulas de insumos, solo si la hoja usa las fórmulas estándar."""
    v, f = hoja["v"], hoja["f"]
    casos = {}
    if f.get("N36") == "=(O8*K11)/B14" and numero(v.get("N36")) is not None:
        casos["manoDeObra"] = {"valorMinuto": numero(v.get("O8")), "moMin": numero(v.get("K11")),
                               "montaje": numero(v.get("B14")), "esperado": numero(v["N36"])}
    if f.get("N17") == "=(O10*H12)/B14" and numero(v.get("N17")) is not None:
        casos["material"] = {"gramosPorClise": numero(v.get("O10")), "precioGramo": numero(v.get("H12")),
                             "montaje": numero(v.get("B14")), "esperado": numero(v["N17"])}
    if f.get("O12") == "=60/K11" and numero(v.get("O12")) is not None:
        casos["planchasPorHora"] = {"moMin": numero(v.get("K11")), "esperado": numero(v["O12"])}
    for celda, formula in f.items():
        if isinstance(formula, str) and re.fullmatch(r"=\$?[A-Z]+\$?\d+/\(10\*\$O\$12\*\$B\$14\)", formula):
            fila = re.match(r"[A-Z]+(\d+)", celda).group(1)
            q = numero(v.get(re.search(r"=\$?([A-Z]+\$?\d+)", formula).group(1).replace("$", "")))
            esperado = numero(v.get(celda))
            if q and esperado and numero(v.get("K11")) and numero(v.get("B14")):
                casos["diasRequeridos"] = {"cantidad": q, "moMin": numero(v.get("K11")),
                                           "montaje": numero(v.get("B14")), "horasPorDia": 10,
                                           "esperado": esperado}
                break
    # Solo casos con todos los datos (una celda vacía en Excel cuenta como 0)
    casos = {k: c for k, c in casos.items()
             if all(isinstance(x, (int, float)) for x in c.values())
             and c.get("moMin", 1) > 0 and c.get("montaje", 1) > 0}
    return {"hoja": nombre, **casos} if casos else None


def main():
    celdas = json.load(open(sys.argv[1], encoding="utf-8"))
    destino = Path(sys.argv[2])
    destino.mkdir(parents=True, exist_ok=True)

    cotizaciones, insumos, descartes = [], [], Counter()
    for nombre, hoja in celdas.items():
        caso, motivo = extraer_cotizacion(nombre, hoja)
        if caso:
            cotizaciones.append(caso)
        else:
            descartes[motivo] += 1
        ins = extraer_insumos(nombre, hoja)
        if ins:
            insumos.append(ins)

    json.dump(cotizaciones, open(destino / "hojas-excel-cotizacion.json", "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(insumos, open(destino / "hojas-excel-insumos.json", "w", encoding="utf-8"), ensure_ascii=False)
    print(f"Casos de cotización: {len(cotizaciones)}  |  casos de insumos: {len(insumos)}")
    print("Hojas descartadas por motivo:")
    for motivo, n in descartes.most_common():
        print(f"  {n:4}  {motivo}")


if __name__ == "__main__":
    main()
