"""
Vuelca los valores y las fórmulas de todas las hojas de un Excel a un JSON:
    {"Hoja": {"v": {"A1": valor, ...}, "f": {"A1": "=FORMULA", ...}}, ...}

Uso: python 01_volcar_celdas.py Cotizaciones.xlsx celdas.json
"""
import openpyxl, json, sys
src, out = sys.argv[1], sys.argv[2]
res = {}
for mode in ('f','v'):
    wb = openpyxl.load_workbook(src, data_only=(mode=='v'), read_only=True)
    for ws in wb.worksheets:
        d = res.setdefault(ws.title, {'f':{}, 'v':{}})
        try:
            for row in ws.iter_rows():
                for c in row:
                    if c.value is not None and hasattr(c,'coordinate'):
                        v=c.value
                        if not isinstance(v,(int,float,str)): v=str(v)
                        d[mode][c.coordinate]=v
        except Exception as e:
            d['err']=str(e)
json.dump(res, open(out,'w'))
print(len(res))
