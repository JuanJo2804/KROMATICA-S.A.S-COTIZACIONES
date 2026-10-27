"""
Convierte las hojas del Excel histórico en un JSON que el seed de la API carga
como cotizaciones con origen EXCEL y estado HISTORICA.

Estas cotizaciones alimentan la búsqueda de similares y el modelo de predicción de MO min.

Uso:
    python 03_exportar_historial.py celdas.json ../../datos-privados/hojas-excel-cotizacion.json \
        ../../datos-privados/historial-excel.json
"""
import datetime
import json
import re
import sys
import unicodedata
from pathlib import Path

TIPOS = ["manilla", "portavaso", "haladera", "puntera", "pin", "dige", "sello", "correa",
         "grip", "llavero", "marquilla", "aplique", "bandera"]
SECCION = {
    "troquel": "TROQUEL", "clise": "CLISE", "troquelada": "TROQUELADA", "material": "MATERIAL",
    "armada": "ARMADA", "empaque": "EMPAQUE", "otros": "OTROS",
}


def normalizar(texto):
    texto = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", texto).strip()


def numero(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip().replace(",", "."))
        except ValueError:
            return None
    return None


def coord(c):
    m = re.match(r"([A-Z]+)(\d+)$", c)
    col = 0
    for ch in m.group(1):
        col = col * 26 + ord(ch) - 64
    return int(m.group(2)), col


def valor_a_la_derecha(grilla, etiquetas, etiqueta, max_cols=5, solo_numero=True):
    for (r, c) in sorted(etiquetas.get(etiqueta, [])):
        for dc in range(1, max_cols + 1):
            v = grilla.get((r, c + dc))
            if v is None or (isinstance(v, str) and not v.strip()):
                continue
            if not solo_numero:
                return v
            x = numero(v)
            if x is not None:
                return x
    return None


# Cada vez que se volvía a cotizar una hoja se agregaba otra fecha debajo de la anterior (columna N, O, P o R,
# filas 1 a 6). La fecha de la cotización es la más reciente. Algunas están como fecha y otras como número de
# serie de Excel sin formato (ej. 45572 = 2024-10-07).
FILAS_FECHA = 10
COLUMNAS_FECHA = range(13, 20)  # M a S
SERIAL_MIN = 40000  # 2009-07-06
HOY = datetime.date.today()


def fecha_de(grilla):
    fechas = []
    for (r, c), v in grilla.items():
        if r > FILAS_FECHA:
            continue
        if isinstance(v, str) and re.match(r"\d{4}-\d\d-\d\d", v):
            fechas.append(datetime.date.fromisoformat(v[:10]))
        elif isinstance(v, (int, float)) and not isinstance(v, bool) and c in COLUMNAS_FECHA and r <= 6:
            fecha = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v))
            if SERIAL_MIN <= v and fecha <= HOY:
                fechas.append(fecha)
    return max(fechas).isoformat() if fechas else None


def celda_relativa(grilla, etiquetas, etiqueta, dr, dc):
    """Número en la celda desplazada (dr, dc) desde la primera aparición de la etiqueta."""
    if not etiquetas.get(etiqueta):
        return None
    r, c = sorted(etiquetas[etiqueta])[0]
    return numero(grilla.get((r + dr, c + dc)))


def troquelada_de(grilla, etiquetas, valor_minuto):
    """
    Troqueladas por hora = 60 × valor minuto / $ por unidad (celda "troq/hora" del Excel). El $ por unidad es la
    suma de las filas bisturí, guillotina y madera de la sección 5 (en la práctica solo se usa bisturí).
    """
    precio = sum(x for k in range(3) if (x := celda_relativa(grilla, etiquetas, "bisturi", k, 2)))
    return round(60 * valor_minuto / precio, 2) if precio > 0 and valor_minuto else None


def tipo_corte_de(grilla, etiquetas):
    """Inferido: la hoja no dice el tipo de corte, pero si tiene costo de troquel (sección 1) es troquelado."""
    troquel = celda_relativa(grilla, etiquetas, "1.troqueles", 0, 2)
    return "TROQUELADO" if troquel and troquel > 0 else "BISTURI"


def gramos_por_cm2_de(grilla, etiquetas, gramos_por_clise):
    """Estimación del espesor: gramos por clisé ÷ cm² del clisé (fila "cm2" debajo de "2.clise")."""
    cm2 = celda_relativa(grilla, etiquetas, "2.clise", 1, 1) or celda_relativa(grilla, etiquetas, "2.clise", 1, 2)
    return round(gramos_por_clise / cm2, 6) if gramos_por_clise and cm2 and cm2 > 0 else None


def main():
    celdas = json.load(open(sys.argv[1], encoding="utf-8"))
    casos = {c["hoja"]: c for c in json.load(open(sys.argv[2], encoding="utf-8"))}
    destino = Path(sys.argv[3])

    salida = []
    for nombre, hoja in celdas.items():
        grilla = {coord(c): v for c, v in hoja["v"].items()}
        etiquetas = {}
        for pos, v in grilla.items():
            if isinstance(v, str):
                etiquetas.setdefault(normalizar(v), []).append(pos)

        mo_min = valor_a_la_derecha(grilla, etiquetas, "mo min", 3)
        montaje = valor_a_la_derecha(grilla, etiquetas, "montaje", 3)
        if not mo_min or not montaje or mo_min <= 0 or montaje <= 0:
            continue

        cliente = valor_a_la_derecha(grilla, etiquetas, "cliente:", 4, solo_numero=False)
        referencia = None
        if etiquetas.get("cliente:"):
            r, c = sorted(etiquetas["cliente:"])[0]
            referencia = grilla.get((r + 1, c + 1))
        tamano = str(valor_a_la_derecha(grilla, etiquetas, "tamano", 3, solo_numero=False) or "")
        m = re.match(r"\s*([\d.,]+)\s*[xX*]\s*([\d.,]+)", tamano)
        ancho, alto = (numero(m.group(1)), numero(m.group(2))) if m else (None, None)

        texto = normalizar(f"{nombre} {referencia or ''} {hoja['v'].get('G4', '')}")
        tipo = next((t for t in TIPOS if t in texto), None)

        valor_minuto = valor_a_la_derecha(grilla, etiquetas, "valor minuto", 4) or 0
        gramos_por_clise = valor_a_la_derecha(grilla, etiquetas, "gramos/clise", 4) or 0
        registro = {
            "hoja": nombre,
            "fecha": fecha_de(grilla),
            "cliente": str(cliente).strip() if cliente not in (None, "") else None,
            "referencia": str(referencia).strip() if referencia not in (None, "") else None,
            "tipoProducto": tipo,
            "anchoCm": ancho,
            "altoCm": alto,
            "tintas": int(t) if (t := valor_a_la_derecha(grilla, etiquetas, "n. tintas", 3)) else None,
            "montaje": int(round(montaje)),
            "moMin": mo_min,
            "valorMinuto": valor_minuto,
            "gramosPorClise": gramos_por_clise,
            "gramosPorCm2": gramos_por_cm2_de(grilla, etiquetas, gramos_por_clise),
            "tipoCorte": tipo_corte_de(grilla, etiquetas),
            "troqueladasPorHora": troquelada_de(grilla, etiquetas, valor_minuto),
            "precioGramo": valor_a_la_derecha(grilla, etiquetas, "$ gramo", 3)
                           or valor_a_la_derecha(grilla, etiquetas, "valor cm2", 4) or 0,
            "calculo": None,
        }

        caso = casos.get(nombre)
        if caso:
            e = caso["entrada"]
            registro["calculo"] = {
                "conceptos": [
                    {"seccion": SECCION.get(c["codigo"], "ADICIONAL"), "codigo": c["codigo"],
                     "nombre": c["nombre"], "porUnidad": c["porUnidad"], "fijo": c["fijo"]}
                    for c in e["conceptos"]
                ],
                "margenes": e["margenes"],
                "administracion": e["administracion"],
                "cantidades": [
                    {"cantidad": int(q), "cifPorcentaje": e["cif"][i]["porcentaje"],
                     **{k: caso["esperado"][i][k] for k in ("subtotal", "administracion", "cif", "costoTotal")}}
                    for i, q in enumerate(e["cantidades"])
                ],
            }
        salida.append(registro)

    destino.parent.mkdir(parents=True, exist_ok=True)
    json.dump(salida, open(destino, "w", encoding="utf-8"), ensure_ascii=False)
    con_calculo = sum(1 for r in salida if r["calculo"])
    print(f"Cotizaciones exportadas: {len(salida)} (con cálculo completo: {con_calculo})")


if __name__ == "__main__":
    main()
