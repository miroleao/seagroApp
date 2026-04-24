#!/usr/bin/env python3
"""
Script de Migração — SE Agropecuária Nelore de Elite
Colunas corrigidas conforme supabase_schema.sql real.
"""

import pandas as pd
import uuid
import re
from datetime import datetime, date
import warnings
warnings.filterwarnings("ignore")

EXCEL_PATH = "/sessions/brave-keen-dijkstra/mnt/uploads/Doadoras SE Agropecuaria.xlsx"
OUTPUT_PATH = "/sessions/brave-keen-dijkstra/mnt/SE Agro Elite/migracao_dados.sql"
FARM_ID = "aaaaaaaa-0000-0000-0000-000000000001"

def new_uuid(): return str(uuid.uuid4())

def sq(val):
    if val is None: return "NULL"
    try:
        if pd.isna(val): return "NULL"
    except: pass
    s = str(val).strip()
    if s == "" or s.lower() in ("nan","nat","none"): return "NULL"
    return "'" + s.replace("'","''") + "'"

def dt(val):
    if val is None: return "NULL"
    try:
        if pd.isna(val): return "NULL"
    except: pass
    if isinstance(val,(datetime,date)):
        try: return f"'{val.strftime('%Y-%m-%d')}'"
        except: return "NULL"
    s = str(val).strip()
    if s in ("","nan","nat","none","NaT"): return "NULL"
    for fmt in ("%d/%m/%Y","%d/%m/%y","%Y-%m-%d","%d-%m-%Y"):
        try: return f"'{datetime.strptime(s,fmt).strftime('%Y-%m-%d')}'"
        except: pass
    return "NULL"

def num(val):
    if val is None: return "NULL"
    try:
        if pd.isna(val): return "NULL"
    except: pass
    s = str(val).strip().replace(",",".").replace("R$","").replace(" ","")
    if s in ("","nan","-"): return "NULL"
    try: float(s); return s
    except: return "NULL"

def safe(val):
    if val is None: return ""
    try:
        if pd.isna(val): return ""
    except: pass
    s = str(val).strip()
    return "" if s.lower() in ("nan","nat","none") else s

def comment(text):
    lines.append(f"\n-- ══════════════════════════════════════════")
    lines.append(f"-- {text}")
    lines.append(f"-- ══════════════════════════════════════════\n")

# ─── Leitura ──────────────────────────────────────────────────────────────────
print("Lendo planilha...")
xl = pd.ExcelFile(EXCEL_PATH)
df_doadoras  = xl.parse("Doadoras", header=0)
df_rebanho   = xl.parse("REBANHO GADO DE CAMPO", header=0)
df_machos    = xl.parse("Machos", header=0)
df_asp_real  = xl.parse("ASPIRAÇÕES REALIZADAS", header=None)
df_asp_comp  = xl.parse("ASPIRAÇÕES COMPRADAS", header=0)
df_embrioes  = xl.parse("EMBRIÕES", header=0)
df_prenhezes = xl.parse("Prenhezes", header=0)
df_te12      = xl.parse("T.E. 1 e 2", header=0)
df_te3       = xl.parse("T.E. 3", header=0)
df_te4       = xl.parse("T.E. 4", header=0)
df_parcelas  = xl.parse("Parcelas Compras e Vendas", header=None)

lines = []
doadora_id_map   = {}
touro_id_map     = {}
receptora_id_map = {}
asp_placeholder  = {}   # (key) → (sess_id, asp_id)

# ─── 1. DOADORAS ─────────────────────────────────────────────────────────────
comment("1. ANIMAIS — DOADORAS")
df_doadoras.columns = [str(c).strip().upper() for c in df_doadoras.columns]

for _, row in df_doadoras.iterrows():
    nome = safe(row.get("ANIMAL",""))
    if not nome or nome.upper() in ("ANIMAL","NAN",""): continue
    uid   = new_uuid()
    rgn   = safe(row.get("RGN",""))
    nasc  = dt(row.get("NASCIMENTO",None))
    pai   = safe(row.get("PAI",""))
    mae   = safe(row.get("MÃE","") or row.get("MAE",""))
    avo_m = safe(row.get("AVÔ MATERNO","") or row.get("AVO MATERNO",""))
    avo_f = safe(row.get("AVÓ MATERNA","") or row.get("AVO MATERNA",""))
    bisav = safe(row.get("BISAVÓ","") or row.get("BISAVO",""))
    local = safe(row.get("LOCALIZAÇÃO","") or row.get("LOCALIZACAO",""))
    obs   = safe(row.get("OBSERVAÇÕES","") or row.get("OBSERVACOES",""))
    vparc = num(row.get("VALOR PARCELA",None))
    perc_r= num(row.get("PERCENTUAL",None))
    perc_sql = "NULL"
    if perc_r != "NULL":
        try:
            p = float(perc_r)
            if p > 1: p = p/100.0
            perc_sql = str(round(p,6))
        except: pass
    doadora_id_map[nome.upper()] = uid
    if rgn: doadora_id_map[rgn.upper()] = uid
    lines.append(
        f"INSERT INTO animals (id,farm_id,nome,rgn,tipo,nascimento,"
        f"pai_nome,mae_nome,avo_materno,avo_materna,bisavo,"
        f"localizacao,percentual_proprio,valor_parcela,observacoes) VALUES "
        f"('{uid}','{FARM_ID}',{sq(nome)},{sq(rgn) if rgn else 'NULL'},"
        f"'DOADORA',{nasc},{sq(pai)},{sq(mae)},{sq(avo_m)},{sq(avo_f)},{sq(bisav)},"
        f"{sq(local)},{perc_sql},{vparc},{sq(obs)});"
    )
print(f"  → {len(df_doadoras)} linhas doadoras")

# ─── 2. TOUROS ────────────────────────────────────────────────────────────────
comment("2. ANIMAIS — TOUROS")
df_machos.columns = [str(c).strip().upper() for c in df_machos.columns]
nome_col = "MACHO" if "MACHO" in df_machos.columns else df_machos.columns[0]

for _, row in df_machos.iterrows():
    nome = safe(row.get(nome_col,""))
    if not nome or nome.upper() in ("MACHO","NAN",""): continue
    uid  = new_uuid()
    rgn  = safe(row.get("RGN",""))
    nasc = dt(row.get("NASC.",None) or row.get("NASCIMENTO",None))
    pai  = safe(row.get("PAI",""))
    mae  = safe(row.get("MÃE","") or row.get("MAE",""))
    local= safe(row.get("LOCALIZAÇÃO","") or row.get("LOCALIZACAO",""))
    touro_id_map[nome.upper()] = uid
    if rgn: touro_id_map[rgn.upper()] = uid
    lines.append(
        f"INSERT INTO animals (id,farm_id,nome,rgn,tipo,nascimento,pai_nome,mae_nome,localizacao) VALUES "
        f"('{uid}','{FARM_ID}',{sq(nome)},{sq(rgn) if rgn else 'NULL'},"
        f"'TOURO',{nasc},{sq(pai)},{sq(mae)},{sq(local)});"
    )
print(f"  → {len(df_machos)} linhas touros")

# ─── 3. REBANHO (RECEPTORAS) + PESAGENS ───────────────────────────────────────
comment("3. ANIMAIS — REBANHO (RECEPTORAS)")
df_rebanho.columns = [str(c).strip().upper() for c in df_rebanho.columns]
PESO_COLS = [c for c in df_rebanho.columns if "PESO" in c]
PESO_DATES = {}
for c in PESO_COLS:
    m = re.search(r"(\d{1,2})[/\-\.](\d{1,2})(?:[/\-\.](\d{2,4}))?", c)
    if m:
        d,mo,y = m.group(1),m.group(2),m.group(3)
        if y is None: y = "2025" if int(mo)>=8 else "2026"
        elif len(y)==2: y = "20"+y
        PESO_DATES[c] = f"'{y}-{mo.zfill(2)}-{d.zfill(2)}'"
    else: PESO_DATES[c] = "NULL"

weight_lines = []
for _, row in df_rebanho.iterrows():
    brinco = safe(row.get("BRINCO",""))
    if not brinco or brinco.upper() in ("BRINCO","NAN",""): continue
    uid     = new_uuid()
    situacao= safe(row.get("SITUAÇÃO","") or row.get("SITUACAO",""))
    obs     = safe(row.get("OBSERVAÇÕES","") or row.get("OBSERVACOES",""))
    id_ant  = safe(row.get("ID ANTERIOR",""))
    tipo    = "DESCARTE" if situacao.upper() in ("DESCARTE","MORTA","VENDIDA") else "RECEPTORA"
    obs_parts = []
    if id_ant:   obs_parts.append(f"ID Anterior: {id_ant}")
    if situacao: obs_parts.append(f"Situação: {situacao}")
    if obs:      obs_parts.append(obs)
    receptora_id_map[brinco.upper()] = uid
    lines.append(
        f"INSERT INTO animals (id,farm_id,nome,brinco,tipo,situacao,observacoes) VALUES "
        f"('{uid}','{FARM_ID}',{sq(brinco)},{sq(brinco)},{sq(tipo)},"
        f"{sq(situacao) if situacao else 'NULL'},{sq(' | '.join(obs_parts))});"
    )
    for pcol in PESO_COLS:
        pval = num(row.get(pcol,None))
        pdate= PESO_DATES.get(pcol,"NULL")
        if pval!="NULL" and pdate!="NULL":
            weight_lines.append(
                f"INSERT INTO weight_records (id,farm_id,animal_id,data,peso_kg) VALUES "
                f"('{new_uuid()}','{FARM_ID}','{uid}',{pdate},{pval});"
            )
print(f"  → {len(receptora_id_map)} receptoras, {len(weight_lines)} pesagens")
comment("3b. PESAGENS")
lines.extend(weight_lines)

# ─── 4. ASPIRAÇÕES REALIZADAS ─────────────────────────────────────────────────
comment("4. ASPIRAÇÕES REALIZADAS")
current_sess_id = None

for idx, row in df_asp_real.iterrows():
    raw  = list(row.values)
    vals = [safe(v) for v in raw]
    if not [v for v in vals if v]: continue
    v2 = vals[2] if len(vals)>2 else ""
    v5 = vals[5] if len(vals)>5 else ""
    v7 = vals[7] if len(vals)>7 else ""
    if "DATA" in v2.upper():
        date_sql = dt(raw[3] if len(raw)>3 else None)
        if date_sql != "NULL":
            sess_id = new_uuid()
            current_sess_id = sess_id
            resp  = v5 if v5 else None
            local = v7 if v7 else None
            lines.append(
                f"INSERT INTO opu_sessions (id,farm_id,data,responsavel,local,tipo) VALUES "
                f"('{sess_id}','{FARM_ID}',{date_sql},{sq(resp)},{sq(local)},'REALIZADA');"
            )
        continue
    if vals[0]=="#" or (len(vals)>1 and vals[1].upper() in ("DOADORA","ANIMAL")): continue
    if current_sess_id is None: continue
    doadora_n = vals[1] if len(vals)>1 else ""
    if not doadora_n or "TOTAL" in doadora_n.upper(): continue
    oocitos = num(raw[4] if len(raw)>4 else None)
    touro_n = vals[5] if len(vals)>5 else ""
    try: impl = float(raw[6]) if raw[6] and str(raw[6]).strip() not in ("-","nan","") else 0
    except: impl = 0
    try: vitr = float(raw[7]) if len(raw)>7 and raw[7] and str(raw[7]).strip() not in ("-","nan","") else 0
    except: vitr = 0
    total_emb = int(impl+vitr) if (impl+vitr)>0 else None
    doadora_id = doadora_id_map.get(doadora_n.upper())
    obs = f"Touro: {touro_n}" if touro_n else ""
    lines.append(
        f"INSERT INTO aspirations (id,farm_id,session_id,doadora_id,doadora_nome,"
        f"oocitos_viaveis,embryos_congelados,observacoes) VALUES "
        f"('{new_uuid()}','{FARM_ID}','{current_sess_id}',"
        f"{sq(doadora_id) if doadora_id else 'NULL'},{sq(doadora_n)},"
        f"{oocitos if oocitos!='NULL' else 'NULL'},"
        f"{total_emb if total_emb is not None else 'NULL'},{sq(obs)});"
    )

# ─── 5. ASPIRAÇÕES COMPRADAS ──────────────────────────────────────────────────
comment("5. ASPIRAÇÕES COMPRADAS")
df_asp_comp.columns = [str(c).strip().upper() for c in df_asp_comp.columns]

for _, row in df_asp_comp.iterrows():
    doadora_n = safe(row.get("DOADORA",""))
    if not doadora_n or doadora_n.upper() in ("DOADORA","NAN",""): continue
    data_asp = dt(row.get("DATA ASPIRAÇÃO",None))
    touro_n  = safe(row.get("TOURO ACASALAMENTO","") or row.get("TOURO",""))
    oocitos  = num(row.get("OOCITOS VIÁVEIS",None) or row.get("OOCITOS",None))
    te_total = num(row.get("T.E.",None))
    lab      = safe(row.get("EQUIPE/LABORATORIO","") or row.get("LAB",""))
    obs      = safe(row.get("OBSERVAÇÃO","") or row.get("OBS",""))
    local    = safe(row.get("LOCALIZAÇÃO","") or row.get("LOCALIZACAO",""))
    sess_id  = new_uuid()
    lines.append(
        f"INSERT INTO opu_sessions (id,farm_id,data,laboratorio,responsavel,local,tipo) VALUES "
        f"('{sess_id}','{FARM_ID}',{data_asp},{sq(lab)},{sq(lab)},{sq(local)},'COMPRADA');"
    )
    doadora_id = doadora_id_map.get(doadora_n.upper())
    te_int = int(float(te_total)) if te_total!="NULL" else None
    lines.append(
        f"INSERT INTO aspirations (id,farm_id,session_id,doadora_id,doadora_nome,"
        f"touro_nome,oocitos_viaveis,embryos_congelados,observacoes) VALUES "
        f"('{new_uuid()}','{FARM_ID}','{sess_id}',"
        f"{sq(doadora_id) if doadora_id else 'NULL'},{sq(doadora_n)},"
        f"{sq(touro_n)},{oocitos},"
        f"{te_int if te_int is not None else 'NULL'},{sq(obs)});"
    )

# ─── Helper: cria aspiration placeholder ──────────────────────────────────────
def ensure_asp(doadora_n, data_key, doadora_id=None, touro_n=None, resp=None):
    key = (doadora_n.upper(), data_key)
    if key not in asp_placeholder:
        sp = new_uuid(); ap = new_uuid()
        asp_placeholder[key] = (sp, ap)
        date_val = data_key if data_key!="NULL" else "CURRENT_DATE"
        lines.append(
            f"INSERT INTO opu_sessions (id,farm_id,data,responsavel,tipo) VALUES "
            f"('{sp}','{FARM_ID}',{date_val},{sq(resp)},'REALIZADA');"
        )
        lines.append(
            f"INSERT INTO aspirations (id,farm_id,session_id,doadora_id,doadora_nome,touro_nome) VALUES "
            f"('{ap}','{FARM_ID}','{sp}',"
            f"{sq(doadora_id) if doadora_id else 'NULL'},{sq(doadora_n)},{sq(touro_n)});"
        )
    return asp_placeholder[key]

# ─── 6. EMBRIÕES (aba EMBRIÕES) ───────────────────────────────────────────────
comment("6. EMBRIÕES E TRANSFERÊNCIAS (aba EMBRIÕES)")
df_embrioes.columns = [str(c).strip().upper() for c in df_embrioes.columns]

for _, row in df_embrioes.iterrows():
    doadora_n = safe(row.get("DOADORA",""))
    if not doadora_n or doadora_n.upper() in ("DOADORA","NAN",""): continue
    data_te   = dt(row.get("DATA T.E.",None))
    resp      = safe(row.get("RESPONSAVEL","") or row.get("RESPONSÁVEL",""))
    touro_n   = safe(row.get("PAI DA PRENHEZ",""))
    nro_cdc   = safe(row.get("Nº CDC-FIV","") or row.get("N CDC-FIV",""))
    nro_adt   = ""
    for c in df_embrioes.columns:
        if "ADT" in c: nro_adt = safe(row.get(c,"")); break
    sexagem_r = safe(row.get("SEXAGEM",""))
    nome_nasc = safe(row.get("NOME",""))
    rgn_nasc  = safe(row.get("RGN",""))
    dna       = safe(row.get("DNA",""))
    parto_c   = next((c for c in df_embrioes.columns if "PARTO" in c or "NASC" in c),None)
    parto_dt  = dt(row.get(parto_c,None)) if parto_c else "NULL"
    doadora_id= doadora_id_map.get(doadora_n.upper())
    sx = sexagem_r.upper()
    sexagem_val = ("'FEMEA'" if sx in ("F","FEMEA","FÊMEA") else
                   ("'MACHO'" if sx in ("M","MACHO") else "'NAO_SEXADO'"))
    obs_parts = []
    if nro_cdc: obs_parts.append(f"CDC-FIV: {nro_cdc}")
    if nro_adt: obs_parts.append(f"ADT-TE: {nro_adt}")
    if dna:     obs_parts.append(f"DNA: {dna}")
    if nome_nasc: obs_parts.append(f"Nome: {nome_nasc}")
    if rgn_nasc:  obs_parts.append(f"RGN: {rgn_nasc}")
    _, asp_ph = ensure_asp(doadora_n, data_te, doadora_id, touro_n, resp)
    emb_id = new_uuid()
    lines.append(
        f"INSERT INTO embryos (id,farm_id,aspiration_id,numero_cdc_fiv,numero_adt_te,"
        f"sexagem,status,observacoes) VALUES "
        f"('{emb_id}','{FARM_ID}','{asp_ph}',"
        f"{sq(nro_cdc)},{sq(nro_adt)},"
        f"{sexagem_val},'IMPLANTADO',{sq(' | '.join(obs_parts))});"
    )
    if data_te != "NULL":
        tid = new_uuid()
        lines.append(
            f"INSERT INTO transfers (id,farm_id,embryo_id,responsavel,data_te) VALUES "
            f"('{tid}','{FARM_ID}','{emb_id}',{sq(resp)},{data_te});"
        )
        if parto_dt != "NULL":
            dgid = new_uuid()
            lines.append(
                f"INSERT INTO pregnancy_diagnoses (id,farm_id,transfer_id,data_dg,resultado,data_previsao_parto) VALUES "
                f"('{dgid}','{FARM_ID}','{tid}',{parto_dt},'POSITIVO',{parto_dt});"
            )

# ─── 7. T.E. 1 e 2 ────────────────────────────────────────────────────────────
comment("7. TRANSFERÊNCIAS T.E. 1 e 2")
df_te12.columns = [str(c).strip().upper() for c in df_te12.columns]

for _, row in df_te12.iterrows():
    rec_nome = safe(row.get("RECEPTORA",""))
    if not rec_nome or rec_nome.upper() in ("RECEPTORA","NAN",""): continue
    brinco_a  = safe(row.get("BRINCO ATUAL","") or row.get("BRINCO",""))
    doadora_n = safe(row.get("DOADORA",""))
    embriao_d = safe(row.get("EMBRIÃO","") or row.get("EMBRIAO",""))
    data_te   = dt(row.get("DATA",None))
    if data_te=="NULL": continue
    nasceu    = safe(row.get("NASCEU",""))
    pp        = dt(row.get("P.P.",None))
    te_nome   = safe(row.get("T.E.","") or row.get("TE",""))
    doadora_id= doadora_id_map.get(doadora_n.upper())
    receptora_id = receptora_id_map.get(brinco_a.upper()) or receptora_id_map.get(rec_nome.upper())
    obs = " | ".join(filter(None,[f"Doadora: {doadora_n}" if doadora_n else "",
                                   f"Embrião: {embriao_d}" if embriao_d else "",
                                   f"TE: {te_nome}" if te_nome else ""]))
    _, asp_ph = ensure_asp(doadora_n, data_te, doadora_id)
    emb_id = new_uuid()
    lines.append(
        f"INSERT INTO embryos (id,farm_id,aspiration_id,status) VALUES "
        f"('{emb_id}','{FARM_ID}','{asp_ph}','IMPLANTADO');"
    )
    tid = new_uuid()
    lines.append(
        f"INSERT INTO transfers (id,farm_id,embryo_id,receptora_id,receptora_brinco,"
        f"sessao_nome,data_te,observacoes) VALUES "
        f"('{tid}','{FARM_ID}','{emb_id}',"
        f"{sq(receptora_id) if receptora_id else 'NULL'},{sq(brinco_a)},"
        f"{sq(te_nome)},{data_te},{sq(obs)});"
    )
    if nasceu and nasceu.upper() not in ("NAN","","NÃO","NAO","N"):
        dgid = new_uuid()
        dg_date = pp if pp!="NULL" else "CURRENT_DATE"
        lines.append(
            f"INSERT INTO pregnancy_diagnoses (id,farm_id,transfer_id,data_dg,resultado,data_previsao_parto) VALUES "
            f"('{dgid}','{FARM_ID}','{tid}',{dg_date},'POSITIVO',{pp});"
        )

# ─── 8. T.E. 3 ────────────────────────────────────────────────────────────────
comment("8. TRANSFERÊNCIAS T.E. 3")
df_te3.columns = [str(c).strip().upper() for c in df_te3.columns]

for _, row in df_te3.iterrows():
    brinco = safe(row.get("BRINCO",""))
    if not brinco or brinco.upper() in ("NAN","BRINCO",""): continue
    data_impl = dt(row.get("IMPLANTE",None))
    if data_impl=="NULL": continue
    cloe     = safe(row.get("CLOE/CLOD","") or row.get("CLOE",""))
    te_nome  = safe(row.get("T.E.","") or row.get("TE",""))
    dg_date  = dt(row.get("DG 02/10/25",None) or row.get("DG",None))
    peso     = num(row.get("PESO",None))
    brinco_ant = safe(row.get("BRINCO ANTIGO",""))
    receptora_id = receptora_id_map.get(brinco.upper())
    prot = ("'CLOE'" if "CLOE" in cloe.upper() else
            ("'CLOD'" if "CLOD" in cloe.upper() else "NULL"))
    obs = " | ".join(filter(None,[f"CLOE/CLOD: {cloe}" if cloe else "",
                                   f"Brinco antigo: {brinco_ant}" if brinco_ant else ""]))
    key = ("_TE3_"+brinco.upper(), data_impl)
    if key not in asp_placeholder:
        sp=new_uuid(); ap=new_uuid()
        asp_placeholder[key]=(sp,ap)
        lines.append(f"INSERT INTO opu_sessions (id,farm_id,data,tipo) VALUES ('{sp}','{FARM_ID}',{data_impl},'REALIZADA');")
        lines.append(f"INSERT INTO aspirations (id,farm_id,session_id) VALUES ('{ap}','{FARM_ID}','{sp}');")
    _, asp_ph = asp_placeholder[key]
    emb_id = new_uuid()
    lines.append(f"INSERT INTO embryos (id,farm_id,aspiration_id,status) VALUES ('{emb_id}','{FARM_ID}','{asp_ph}','IMPLANTADO');")
    tid = new_uuid()
    lines.append(
        f"INSERT INTO transfers (id,farm_id,embryo_id,receptora_id,receptora_brinco,"
        f"sessao_nome,data_te,protocolo,peso_receptora,observacoes) VALUES "
        f"('{tid}','{FARM_ID}','{emb_id}',"
        f"{sq(receptora_id) if receptora_id else 'NULL'},{sq(brinco)},"
        f"{sq(te_nome)},{data_impl},{prot},{peso},{sq(obs)});"
    )
    if dg_date!="NULL":
        dgid=new_uuid()
        lines.append(f"INSERT INTO pregnancy_diagnoses (id,farm_id,transfer_id,data_dg,resultado) VALUES ('{dgid}','{FARM_ID}','{tid}',{dg_date},'POSITIVO');")

# ─── 9. T.E. 4 ────────────────────────────────────────────────────────────────
comment("9. TRANSFERÊNCIAS T.E. 4")
df_te4.columns = [str(c).strip().upper() for c in df_te4.columns]

for _, row in df_te4.iterrows():
    brinco = safe(row.get("BRINCO",""))
    if not brinco or brinco.upper() in ("NAN","BRINCO",""): continue
    data_te  = dt(row.get("DATA T.E.",None))
    if data_te=="NULL": continue
    situacao = safe(row.get("SITUAÇÃO","") or row.get("SITUACAO",""))
    doadora_n= safe(row.get("DOADORA",""))
    touro_n  = safe(row.get("TOURO",""))
    dg_date  = dt(row.get("DG",None))
    pp       = dt(row.get("DATA P.P.",None))
    receptora_id = receptora_id_map.get(brinco.upper())
    doadora_id   = doadora_id_map.get(doadora_n.upper())
    obs = " | ".join(filter(None,[f"Doadora: {doadora_n}" if doadora_n else "",
                                   f"Touro: {touro_n}" if touro_n else ""]))
    _, asp_ph = ensure_asp(doadora_n if doadora_n else "_TE4_"+brinco, data_te, doadora_id, touro_n)
    emb_id = new_uuid()
    lines.append(f"INSERT INTO embryos (id,farm_id,aspiration_id,status) VALUES ('{emb_id}','{FARM_ID}','{asp_ph}','IMPLANTADO');")
    tid = new_uuid()
    lines.append(
        f"INSERT INTO transfers (id,farm_id,embryo_id,receptora_id,receptora_brinco,sessao_nome,data_te,observacoes) VALUES "
        f"('{tid}','{FARM_ID}','{emb_id}',"
        f"{sq(receptora_id) if receptora_id else 'NULL'},{sq(brinco)},'T.E. 4',{data_te},{sq(obs)});"
    )
    if dg_date!="NULL":
        result = "'VAZIO'" if situacao.upper() in ("VAZIA","NEGATIVO","NEG") else "'POSITIVO'"
        dgid=new_uuid()
        lines.append(
            f"INSERT INTO pregnancy_diagnoses (id,farm_id,transfer_id,data_dg,resultado,data_previsao_parto) VALUES "
            f"('{dgid}','{FARM_ID}','{tid}',{dg_date},{result},{pp});"
        )

# ─── 10. PRENHEZES ────────────────────────────────────────────────────────────
comment("10. PRENHEZES")
df_prenhezes.columns = [str(c).strip().upper() for c in df_prenhezes.columns]
pp_col = next((c for c in df_prenhezes.columns if "PARTO" in c or "P.P." in c),None)

for _, row in df_prenhezes.iterrows():
    doadora_n = safe(row.get("DOADORA",""))
    if not doadora_n or doadora_n.upper() in ("DOADORA","NAN",""): continue
    touro_n    = safe(row.get("TOURO ACASALAMENTO","") or row.get("TOURO",""))
    qtd        = num(row.get("QUANTIDADE",None))
    receptoras = safe(row.get("RECEPTORAS",""))
    prev_parto = dt(row.get(pp_col,None)) if pp_col else "NULL"
    leilao     = safe(row.get("LLEILÃO","") or row.get("LEILÃO","") or row.get("LEILAO",""))
    obs        = safe(row.get("OBSERVAÇÃO","") or row.get("OBSERVACAO",""))
    doadora_id = doadora_id_map.get(doadora_n.upper())
    obs_parts  = list(filter(None,[
        f"Touro: {touro_n}" if touro_n else "",
        f"Receptoras: {receptoras}" if receptoras else "",
        f"Leilão: {leilao}" if leilao else "",
        f"Qtd: {qtd}" if qtd!="NULL" else "",
        obs
    ]))
    _, asp_ph = ensure_asp(doadora_n, prev_parto, doadora_id, touro_n)
    emb_id = new_uuid()
    lines.append(
        f"INSERT INTO embryos (id,farm_id,aspiration_id,status,observacoes) VALUES "
        f"('{emb_id}','{FARM_ID}','{asp_ph}','IMPLANTADO',{sq(' | '.join(obs_parts))});"
    )
    date_val = prev_parto if prev_parto!="NULL" else "CURRENT_DATE"
    tid = new_uuid()
    lines.append(
        f"INSERT INTO transfers (id,farm_id,embryo_id,data_te,observacoes) VALUES "
        f"('{tid}','{FARM_ID}','{emb_id}',{date_val},{sq(' | '.join(obs_parts) + ' | Doadora: '+doadora_n)});"
    )
    dgid=new_uuid()
    lines.append(
        f"INSERT INTO pregnancy_diagnoses (id,farm_id,transfer_id,data_dg,resultado,data_previsao_parto) VALUES "
        f"('{dgid}','{FARM_ID}','{tid}',{date_val},'POSITIVO',{prev_parto});"
    )

# ─── 11. PARCELAS COMPRAS E VENDAS ────────────────────────────────────────────
comment("11. PARCELAS COMPRAS E VENDAS")
auction_map = {}

def get_auction(nome, data_val):
    key = safe(nome).upper()
    if not key or key in ("NAN",""): return None
    if key not in auction_map:
        aid = new_uuid()
        auction_map[key] = aid
        lines.append(
            f"INSERT INTO auctions (id,farm_id,nome,data) VALUES "
            f"('{aid}','{FARM_ID}',{sq(nome)},{data_val});"
        )
    return auction_map[key]

for idx, row in df_parcelas.iterrows():
    if idx < 5: continue
    vals = list(row.values)
    # COMPRAS
    c_leil=safe(vals[1] if len(vals)>1 else "")
    c_data=dt(vals[2] if len(vals)>2 else None)
    c_prod=safe(vals[3] if len(vals)>3 else "")
    c_tipo=safe(vals[4] if len(vals)>4 else "")
    c_vend=safe(vals[5] if len(vals)>5 else "")
    c_val =num(vals[6] if len(vals)>6 else "")
    if c_leil and c_leil.lower() not in ("nan","","leilão","leilao") and c_val!="NULL":
        aid = get_auction(c_leil,c_data)
        if aid:
            txid=new_uuid()
            lines.append(
                f"INSERT INTO transactions (id,farm_id,auction_id,tipo,animal_nome,contraparte,valor_total,observacoes) VALUES "
                f"('{txid}','{FARM_ID}','{aid}','COMPRA',{sq(c_prod)},{sq(c_vend)},{c_val},{sq(c_tipo)});"
            )
            dv = c_data if c_data!="NULL" else "CURRENT_DATE"
            lines.append(
                f"INSERT INTO installments (id,farm_id,transaction_id,numero,vencimento,valor,status) VALUES "
                f"('{new_uuid()}','{FARM_ID}','{txid}',1,{dv},{c_val},'PENDENTE');"
            )
    # VENDAS
    v_leil=safe(vals[9]  if len(vals)>9  else "")
    v_data=dt(vals[10] if len(vals)>10 else None)
    v_prod=safe(vals[11] if len(vals)>11 else "")
    v_tipo=safe(vals[12] if len(vals)>12 else "")
    v_comp=safe(vals[13] if len(vals)>13 else "")
    v_val =num(vals[14] if len(vals)>14 else "")
    if v_leil and v_leil.lower() not in ("nan","","leilão","leilao") and v_val!="NULL":
        aid = get_auction(v_leil,v_data)
        if aid:
            txid=new_uuid()
            lines.append(
                f"INSERT INTO transactions (id,farm_id,auction_id,tipo,animal_nome,contraparte,valor_total,observacoes) VALUES "
                f"('{txid}','{FARM_ID}','{aid}','VENDA',{sq(v_prod)},{sq(v_comp)},{v_val},{sq(v_tipo)});"
            )
            dv = v_data if v_data!="NULL" else "CURRENT_DATE"
            lines.append(
                f"INSERT INTO installments (id,farm_id,transaction_id,numero,vencimento,valor,status) VALUES "
                f"('{new_uuid()}','{FARM_ID}','{txid}',1,{dv},{v_val},'PENDENTE');"
            )
print(f"  → {len(auction_map)} leilões")

# ─── MONTAR SQL FINAL ─────────────────────────────────────────────────────────
header = f"""-- ============================================================
-- MIGRAÇÃO DE DADOS — SE Agropecuária Nelore de Elite
-- Gerado: {datetime.now().strftime("%Y-%m-%d %H:%M")}
-- ============================================================
-- INSTRUÇÕES:
--   1. Abra o Supabase SQL Editor
--   2. Clique em "+ New query"
--   3. Cole TODO este conteúdo e clique em Run
--   4. Se aparecer "Success" está ok
-- ============================================================

BEGIN;

SET search_path TO public;
"""

footer = """
COMMIT;

-- ============================================================
-- VERIFICAÇÃO — cole e execute em uma nova query:
-- SELECT tipo, COUNT(*) FROM animals
--   WHERE farm_id = 'aaaaaaaa-0000-0000-0000-000000000001'
--   GROUP BY tipo ORDER BY 2 DESC;
-- ============================================================
"""

sql = header + "\n".join(lines) + footer
with open(OUTPUT_PATH,"w",encoding="utf-8") as f:
    f.write(sql)

print(f"\n✅ Script gerado: {OUTPUT_PATH}")
print(f"   {sql.count(chr(10))} linhas | {sql.count('INSERT INTO')} INSERTs")
